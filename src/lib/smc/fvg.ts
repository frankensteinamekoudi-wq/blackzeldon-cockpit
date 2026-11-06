import { Candle } from './structure.js';

export interface FairValueGap {
  type: 'bull' | 'bear';
  top: number;
  bottom: number;
  mid: number;
  size: number;
  fill: number; // 0 (non mitige) a 1 (entierement mitige)
  mitigated: boolean;
  idx: number;
  time?: string | number;
}

export function detectFVG(candles: Candle[], pipSize = 0.0001, isCrypto = false): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  if (!candles || candles.length < 5) return fvgs;
  const n = candles.length;
  const livePrice = candles[n - 1].close;
  const lookback = Math.min(n, 35);
  const thresholdScale = isCrypto ? 1.5 : 1.0;
  const minSize = pipSize * 0.5 * thresholdScale;

  for (let i = Math.max(0, n - lookback); i < n - 2; i++) {
    const c1 = candles[i];
    const c3 = candles[i + 2];
    if (!c1 || !c3) continue;

    // Bullish FVG (gap entre high de c1 et low de c3)
    if (c1.high < c3.low) {
      const top = c3.low;
      const bottom = c1.high;
      const size = top - bottom;
      if (size >= minSize) {
        const mid = (top + bottom) / 2;
        // Pénétration réelle des bougies SUIVANTES dans le gap (avant : un prix qui s'éloigne
        // au-dessus du gap était compté « rempli à 100 % » et le FVG le plus propre était supprimé).
        const after = candles.slice(i + 3);
        const minLow = after.length ? Math.min(...after.map(x => x.low)) : Infinity;
        const fill = minLow >= top ? 0 : Math.min(1, (top - minLow) / size);
        const invalidated = after.some(x => x.close < bottom);
        const mitigated = invalidated || fill > 0.85;
        fvgs.push({
          type: 'bull',
          top,
          bottom,
          mid,
          size,
          fill,
          mitigated,
          idx: i,
          time: c1.time
        });
      }
    }
    // Bearish FVG (gap entre low de c1 et high de c3)
    else if (c1.low > c3.high) {
      const top = c1.low;
      const bottom = c3.high;
      const size = top - bottom;
      if (size >= minSize) {
        const mid = (top + bottom) / 2;
        const after = candles.slice(i + 3);
        const maxHigh = after.length ? Math.max(...after.map(x => x.high)) : -Infinity;
        const fill = maxHigh <= bottom ? 0 : Math.min(1, (maxHigh - bottom) / size);
        const invalidated = after.some(x => x.close > top);
        const mitigated = invalidated || fill > 0.85;
        fvgs.push({
          type: 'bear',
          top,
          bottom,
          mid,
          size,
          fill,
          mitigated,
          idx: i,
          time: c1.time
        });
      }
    }
  }

  // Filtrer les FVG trop mitiges pour ne garder que les zones de liquidite actives
  const activeFvgs = fvgs.filter(f => !f.mitigated);
  activeFvgs.sort((a, b) => Math.abs(a.mid - livePrice) - Math.abs(b.mid - livePrice));
  return activeFvgs;
}
