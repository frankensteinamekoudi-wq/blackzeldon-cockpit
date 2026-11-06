/**
 * Trade Plan Engine - Calcul des entrées, SL, TP1, TP2, TP3, Break-even et Trailing Stop.
 */

export interface TradePlan {
  entryA: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  be: number;
  trailingStart: number;
  dir: 'bull' | 'bear';
  riskPips: number;
  tp1Pips: number;
  tp2Pips: number;
  tp3Pips: number;
  tradeId?: number;
}

export const BROKER_MIN_LOT = 0.01;
export const MAX_PORTFOLIO_RISK_PCT = 6.0;

export function buildTradePlan(
  dir: 'BUY' | 'SELL',
  entryPrice: number,
  atr: number,
  pipSize = 0.0001,
  structuralStop?: number
): TradePlan {
  const isBull = dir === 'BUY';
  // SL structurel : au-delà du dernier swing (+ marge 0,2 ATR), borné entre 1,2 et 3,5 ATR.
  // À défaut de swing exploitable, repli sur 2,2 ATR (ancien comportement).
  let risk = atr * 2.2;
  if (structuralStop !== undefined && Number.isFinite(structuralStop)) {
    const dist = isBull ? entryPrice - structuralStop : structuralStop - entryPrice;
    if (dist > 0) risk = Math.min(atr * 3.5, Math.max(atr * 1.2, dist + atr * 0.2));
  }
  risk = Math.max(risk, pipSize * 10);

  const sl = isBull ? entryPrice - risk : entryPrice + risk;
  const tp1 = isBull ? entryPrice + risk * 1.0 : entryPrice - risk * 1.0;
  const tp2 = isBull ? entryPrice + risk * 2.0 : entryPrice - risk * 2.0;
  const tp3 = isBull ? entryPrice + risk * 3.0 : entryPrice - risk * 3.0;
  const be = isBull ? entryPrice + risk * 0.35 : entryPrice - risk * 0.35;
  const trailingStart = isBull ? entryPrice + risk * 0.6 : entryPrice - risk * 0.6;

  const riskPips = Math.abs(entryPrice - sl) / pipSize;
  const tp1Pips = Math.abs(tp1 - entryPrice) / pipSize;
  const tp2Pips = Math.abs(tp2 - entryPrice) / pipSize;
  const tp3Pips = Math.abs(tp3 - entryPrice) / pipSize;

  return {
    entryA: entryPrice,
    sl,
    tp1,
    tp2,
    tp3,
    be,
    trailingStart,
    dir: isBull ? 'bull' : 'bear',
    riskPips,
    tp1Pips,
    tp2Pips,
    tp3Pips
  };
}

export function computePositionSizing(
  capital: number,
  riskPercent: number,
  slPips: number,
  pipValue = 10
) {
  const riskAmount = capital * (riskPercent / 100);
  const rawLots = slPips > 0 && pipValue > 0 ? riskAmount / (slPips * pipValue) : 0;
  const lotSize = Math.max(BROKER_MIN_LOT, Math.floor(rawLots * 100) / 100);
  const actualRiskAmount = lotSize * slPips * pipValue;
  const actualRiskPct = capital > 0 ? (actualRiskAmount / capital) * 100 : 0;
  const lotBelowMin = rawLots < BROKER_MIN_LOT;
  const lotDanger = lotBelowMin && actualRiskPct > 15;

  return {
    riskAmount,
    rawLots,
    lotSize,
    actualRiskAmount,
    actualRiskPct,
    lotBelowMin,
    lotDanger
  };
}

/**
 * Garde-fou : le SL et les TP doivent être du bon côté de l'entrée, dans le bon ordre.
 * BUY  : sl < entrée < tp1 < tp2 < tp3 ; SELL : sl > entrée > tp1 > tp2 > tp3.
 */
export function isPlanSane(
  dir: 'BUY' | 'SELL',
  p: { entry: number; sl: number; tp1: number; tp2: number; tp3: number }
): boolean {
  const v = [p.entry, p.sl, p.tp1, p.tp2, p.tp3];
  if (!v.every(Number.isFinite)) return false;
  return dir === 'BUY'
    ? p.sl < p.entry && p.entry < p.tp1 && p.tp1 < p.tp2 && p.tp2 < p.tp3
    : p.sl > p.entry && p.entry > p.tp1 && p.tp1 > p.tp2 && p.tp2 > p.tp3;
}
