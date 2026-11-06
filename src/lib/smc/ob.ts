import { Candle } from './structure.js';

export interface OrderBlock {
  type: 'bull' | 'bear';
  low: number;
  high: number;
  mid: number;
  displacement: number;
  score: number; // 0 to 10
  mitigated: boolean;
  idx: number;
  time?: string | number;
}

export function findOrderBlocks(
  candles: Candle[],
  dir: 'bull' | 'bear',
  range: number,
  pipSize = 0.0001,
  thresholdScale = 1.0
): OrderBlock[] {
  const found: OrderBlock[] = [];
  if (!candles || candles.length < 10) return found;
  const n = candles.length;
  const livePrice = candles[n - 1].close;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const lookback = Math.min(n, 30);

  const rHigh = Math.max(...highs.slice(-30));
  const rLow = Math.min(...lows.slice(-30));

  for (let i = n - 2; i > Math.max(2, n - lookback); i--) {
    const c = candles[i];
    const push = candles.slice(i + 1, i + 4);
    if (push.length < 2) continue;

    const mv = push[push.length - 1].close - push[0].open;
    // Un OB haussier exige un déplacement HAUSSIER (et inversement) : avant, le signe n'était pas vérifié.
    if (dir === 'bull' ? mv <= 0 : mv >= 0) continue;
    const isDisplacement = Math.abs(mv) > range * 0.08 * thresholdScale;
    if (!isDisplacement) continue;

    let obScore = 2; // base score for displacement

    // Check if candle swept previous highs/lows
    if (i > 5) {
      const prevHigh = Math.max(...highs.slice(Math.max(0, i - 10), i));
      const prevLow = Math.min(...lows.slice(Math.max(0, i - 10), i));
      if (dir === 'bull' && c.low < prevLow && c.close > prevLow) obScore += 3;
      if (dir === 'bear' && c.high > prevHigh && c.close < prevHigh) obScore += 3;
    }

    // Check if breakout beyond range
    for (let k = Math.max(0, i - 5); k < i; k++) {
      if (dir === 'bull' && candles[k].high > rHigh && candles[k].close < rHigh) obScore += 3;
      if (dir === 'bear' && candles[k].low < rLow && candles[k].close > rLow) obScore += 3;
    }

    const dirOk = (dir === 'bull' && c.close <= c.open && mv > 0) ||
                  (dir === 'bear' && c.close >= c.open && mv < 0);
    if (dirOk) obScore += 2;

    if (obScore >= 5) {
      // Mitigé = le prix est déjà revenu dans la zone AVANT la dernière bougie (avant : « mitigé » dès que
      // le prix était dedans, ce qui rendait impossible d'identifier un retest frais).
      const mitigated = candles.slice(i + 4, n - 1).some(x => dir === 'bull' ? x.low <= c.high : x.high >= c.low);
      found.push({
        type: dir,
        low: c.low,
        high: c.high,
        mid: (c.low + c.high) / 2,
        displacement: mv,
        score: Math.min(10, obScore),
        mitigated,
        idx: i,
        time: c.time
      });
    }
  }

  // Sort by mitigated first, then score, then proximity
  found.sort((a, b) => {
    if (a.mitigated !== b.mitigated) return a.mitigated ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return Math.abs(a.mid - livePrice) - Math.abs(b.mid - livePrice);
  });

  return found.slice(0, 6);
}
