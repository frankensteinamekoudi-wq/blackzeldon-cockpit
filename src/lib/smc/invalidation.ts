import { Candle, SwingPoint } from './structure.js';

export interface EqualLevel {
  price: number;
  touches: number;
  lastIdx: number;
}

export function clusterEqualLevels(swings: SwingPoint[], tolerance: number): EqualLevel[] {
  if (!swings || swings.length < 2) return [];
  const sorted = [...swings].sort((a, b) => a.price - b.price);
  const clusters: SwingPoint[][] = [];
  let current: SwingPoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].price - current[current.length - 1].price) <= tolerance) {
      current.push(sorted[i]);
    } else {
      if (current.length >= 2) clusters.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length >= 2) clusters.push(current);

  return clusters.map(c => ({
    price: c.reduce((s, p) => s + p.price, 0) / c.length,
    touches: c.length,
    lastIdx: Math.max(...c.map(p => p.idx))
  })).sort((a, b) => b.touches - a.touches);
}

export function detectLiquiditySweeps(candles: Candle[], rHigh: number, rLow: number) {
  let sweep: 'BSL' | 'SSL' | null = null;
  let sweepType: 'haussier' | 'baissier' | null = null;
  for (let i = 0; i < candles.length - 1; i++) {
    const c = candles[i];
    if (c.high > rHigh && c.close < rHigh) {
      sweep = 'BSL';
      sweepType = 'haussier';
    }
    if (c.low < rLow && c.close > rLow) {
      sweep = 'SSL';
      sweepType = 'baissier';
    }
  }
  return { sweep, sweepType };
}

export function getMidnightOpenNY(candles: Candle[]): { price: number; time: string | number; idx: number } | null {
  if (!candles || candles.length < 2) return null;
  try {
    for (let i = candles.length - 1; i >= 0; i--) {
      const d = new Date(candles[i].time);
      const nyHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/New_York' }).format(d), 10);
      if (nyHour === 0 || nyHour === 24) {
        return { price: candles[i].open, time: candles[i].time, idx: i };
      }
    }
  } catch (e) {}
  return null;
}
