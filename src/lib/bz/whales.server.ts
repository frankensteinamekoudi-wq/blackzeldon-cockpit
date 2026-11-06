/**
 * Whale Footprint & Institutional Volume Flow Server Module
 */
import { Candle } from '../smc/structure.js';

export interface WhaleAnomaly {
  detected: boolean;
  type: 'BUY_ABSORPTION' | 'SELL_DUMP' | 'LIQUIDITY_INJECTION' | 'NORMAL';
  volumeMultiple: number;
  priceDelta: number;
  score: number;
  description: string;
}

export function detectWhaleFootprint(candles: Candle[]): WhaleAnomaly {
  if (!candles || candles.length < 15) {
    return {
      detected: false,
      type: 'NORMAL',
      volumeMultiple: 1,
      priceDelta: 0,
      score: 50,
      description: 'Volume institutionnel nominal'
    };
  }

  const recent = candles.slice(-5);
  const lookback = candles.slice(-25, -5);

  const avgVol = lookback.reduce((sum, c) => sum + (c.volume || 1), 0) / Math.max(1, lookback.length);
  const last = recent[recent.length - 1];
  const lastVol = last.volume || 1;
  const volMult = avgVol > 0 ? lastVol / avgVol : 1;

  const candleRange = Math.abs(last.high - last.low);
  const body = Math.abs(last.close - last.open);
  const delta = last.close - last.open;

  // High volume with tiny body = Absorption
  if (volMult >= 2.2 && body < candleRange * 0.3) {
    const isBull = delta >= 0;
    return {
      detected: true,
      type: 'BUY_ABSORPTION',
      volumeMultiple: Number(volMult.toFixed(2)),
      priceDelta: delta,
      score: 88,
      description: `Absorption institutionnelle majeure (${volMult.toFixed(1)}x volume moyen)`
    };
  }

  // Large aggressive expansion with huge volume
  if (volMult >= 2.0 && body >= candleRange * 0.7) {
    const isDump = delta < 0;
    return {
      detected: true,
      type: isDump ? 'SELL_DUMP' : 'LIQUIDITY_INJECTION',
      volumeMultiple: Number(volMult.toFixed(2)),
      priceDelta: delta,
      score: 82,
      description: `Injection directionnelle forte (${volMult.toFixed(1)}x volume moyen)`
    };
  }

  return {
    detected: false,
    type: 'NORMAL',
    volumeMultiple: Number(volMult.toFixed(2)),
    priceDelta: delta,
    score: 55,
    description: 'Flux de volume institutionnel régulier'
  };
}
