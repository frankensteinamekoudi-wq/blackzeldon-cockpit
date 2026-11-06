/**
 * Daily Setup & Multi-Day Bias Server Module
 */
import { Candle } from '../smc/structure.js';

export interface DailyBias {
  pdh: number; // Previous Day High
  pdl: number; // Previous Day Low
  currentPrice: number;
  bias: 'BULLISH_EXPANSION' | 'BEARISH_EXPANSION' | 'RANGE_BOUND';
  adrPctConsumed: number;
  adrPips: number;
  recommendation: string;
}

export function computeDailySetup(dailyCandles: Candle[], currentPrice: number, pipSize: number = 0.0001): DailyBias {
  if (!dailyCandles || dailyCandles.length < 2) {
    return {
      pdh: currentPrice + 50 * pipSize,
      pdl: currentPrice - 50 * pipSize,
      currentPrice,
      bias: 'RANGE_BOUND',
      adrPctConsumed: 45,
      adrPips: 65,
      recommendation: 'Attendre l’ouverture de Londres pour confirmation'
    };
  }

  const prevDay = dailyCandles[dailyCandles.length - 2];
  const today = dailyCandles[dailyCandles.length - 1];

  const pdh = prevDay.high;
  const pdl = prevDay.low;

  // Calculate ADR over 5 days
  const recentDays = dailyCandles.slice(-6, -1);
  const avgRange = recentDays.reduce((acc, d) => acc + (d.high - d.low), 0) / Math.max(1, recentDays.length);
  const adrPips = Math.round(avgRange / pipSize);

  const todayRange = today.high - today.low;
  const adrPctConsumed = Math.min(150, Math.round((todayRange / Math.max(avgRange, 0.0001)) * 100));

  let bias: DailyBias['bias'] = 'RANGE_BOUND';
  let recommendation = 'Équilibre journalier, surveiller les balayages de PDH/PDL';

  if (currentPrice > pdh) {
    bias = 'BULLISH_EXPANSION';
    recommendation = 'Expansion haussière au-dessus du PDH. Chercher des replis FVG en M5/M15';
  } else if (currentPrice < pdl) {
    bias = 'BEARISH_EXPANSION';
    recommendation = 'Rupture baissière sous le PDL. Vendre les retracements sur Order Block';
  }

  return {
    pdh,
    pdl,
    currentPrice,
    bias,
    adrPctConsumed,
    adrPips,
    recommendation
  };
}
