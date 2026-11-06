/**
 * SNIPER $10 ACCOUNT GROWTH & ICT HIDDEN THEORIES ENGINE
 * 
 * Module pour micro-compte : SL serré mais STRUCTUREL (sous/sur le dernier swing + marge de spread),
 * risque plafonné en dollars sur 0,01 lot. Si le SL structurel dépasse le risque autorisé, on SKIP
 * (on ne « compresse » plus artificiellement le SL). Aucun gain n'est garanti.
 * 
 * Includes ICT Hidden Theories:
 * - Judas Swing (London/NY Open false sweep)
 * - SMT Divergence (Smart Money Tool correlation divergence)
 * - AMD (Accumulation -> Manipulation -> Distribution) Cycle
 * - Silver Bullet Delivery Window (10-11 AM NY / 03-04 AM London)
 * - 50% Mean Threshold of Institutional Order Block
 * - Micro-Lot (0.01) Risk Guardrail
 */

import { Candle, analyzeStructure } from './structure.js';
import { calcATR } from '../quantum/edge.js';
import { findOrderBlocks } from './ob.js';
import { detectFVG } from './fvg.js';
import { toMs } from '../bz/candle-utils.js';
import { biasFromStructure } from '../bz/backtest.js';
import { isPlanSane } from '../bz/trade-plan.js';
import { findPairBySymbol, TYPICAL_SPREAD_PIPS, PIP_VALUE_MICRO_LOT } from '../bz/config.js';

export interface SniperConfluence {
  id: string;
  name: string;
  met: boolean;
  weight: number;
  explanation: string;
  tag: 'ICT' | 'SMC' | 'LIQUIDITY' | 'TIMING' | 'RISK';
}

export interface AMDCycle {
  phase: 'ACCUMULATION' | 'MANIPULATION' | 'DISTRIBUTION' | 'EXPANSION';
  progress: number; // 0 to 100%
  description: string;
  rangeHigh: number;
  rangeLow: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface SniperSetup {
  isSniperReady: boolean;
  score: number;
  direction: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  bePrice: number;
  riskPips: number;
  tp1Pips: number;
  tp2Pips: number;
  tp3Pips: number;
  rrRatio: number;
  recommendedLot: number;
  capitalRiskDollars: number;
  capitalGainTP1: number;
  capitalGainTP2: number;
  capitalGainTP3: number;
  accountSafetyStatus: 'PROTECTED' | 'OPTIMAL' | 'DANGER_SKIP';
  confluences: SniperConfluence[];
  amd: AMDCycle;
  judasSwing: {
    detected: boolean;
    sweptSide: 'ASIAN_HIGH' | 'ASIAN_LOW' | 'NONE';
    reversalStrength: number;
    description: string;
  };
  smtDivergence: {
    detected: boolean;
    assetCorrelated: string;
    divergenceType: 'BULLISH_SMT' | 'BEARISH_SMT' | 'NONE';
    description: string;
  };
  silverBullet: {
    isActive: boolean;
    windowName: string;
    description: string;
  };
  compoundPlan: {
    currentBalance: number;
    stepTarget: number;
    nextBalance: number;
    tradesToDouble: number;
  };
}

export interface SniperOptions {
  /** Paire corrélée (clôtures de la même unité de temps) pour la divergence SMT. */
  correlated?: { label: string; closes: number[] };
  spreadPips?: number;
  /** Valeur d'un pip pour 0,01 lot, en $ (sinon table interne – estimation). */
  pipValueMicroLot?: number;
}

const round = (x: number, d: number) => parseFloat(x.toFixed(d));

function nyClock(ms: number): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(new Date(ms));
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return { h, m };
}

export function evaluateSniperOpportunity(
  candles: Candle[],
  symbol: string,
  pipSize: number,
  digits: number,
  accountBalance: number = 10,
  maxRiskDollars: number = 1.0,
  opts: SniperOptions = {}
): SniperSetup {
  if (!candles || candles.length < 30) return createEmptySniper(accountBalance);

  const last = candles[candles.length - 1];
  const lastPrice = last.close;
  const lastMs = toMs(last.time) ?? Date.now();
  const atr = calcATR(candles, 14);
  const pair = findPairBySymbol(symbol);
  const pairId = pair?.id ?? '';
  const isCrypto = pair?.type === 'crypto';

  // ───────── 1. Range asiatique réel (00:00–07:00 UTC du jour de la dernière bougie) ─────────
  const lastDay = new Date(lastMs).toISOString().slice(0, 10);
  const hourOf = (c: Candle) => new Date(toMs(c.time) ?? 0).getUTCHours();
  const dayOf = (c: Candle) => new Date(toMs(c.time) ?? 0).toISOString().slice(0, 10);
  const asian = candles.filter(c => dayOf(c) === lastDay && hourOf(c) < 7);
  const haveAsian = new Date(lastMs).getUTCHours() >= 7 && asian.length >= 3;
  const asianHigh = haveAsian ? Math.max(...asian.map(c => c.high)) : Math.max(...candles.slice(-20).map(c => c.high));
  const asianLow = haveAsian ? Math.min(...asian.map(c => c.low)) : Math.min(...candles.slice(-20).map(c => c.low));

  const post = candles.filter(c => dayOf(c) === lastDay && hourOf(c) >= 7).slice(-6);
  const curHigh = post.length ? Math.max(...post.map(c => c.high)) : lastPrice;
  const curLow = post.length ? Math.min(...post.map(c => c.low)) : lastPrice;

  let amdPhase: AMDCycle['phase'] = 'ACCUMULATION';
  let amdProgress = 20;
  let amdBias: AMDCycle['bias'] = 'NEUTRAL';
  let amdDesc = haveAsian
    ? 'Accumulation : le prix évolue dans le range asiatique.'
    : 'Range asiatique indisponible (session en cours ou données insuffisantes) : AMD non évalué.';

  let judasDetected = false;
  let judasSide: 'ASIAN_HIGH' | 'ASIAN_LOW' | 'NONE' = 'NONE';
  let judasDesc = haveAsian ? 'Pas de faux breakout du range asiatique détecté.' : 'Non évalué (pas de range asiatique exploitable).';
  let reversalStrength = 0;

  if (haveAsian) {
    const sweptHigh = curHigh > asianHigh && lastPrice < asianHigh;
    const sweptLow = curLow < asianLow && lastPrice > asianLow;
    if (sweptHigh) {
      amdPhase = 'MANIPULATION'; amdProgress = 70; amdBias = 'BEARISH';
      amdDesc = 'Manipulation : balayage du haut asiatique puis retour dans le range.';
      judasDetected = true; judasSide = 'ASIAN_HIGH';
      judasDesc = 'Judas Swing baissier : faux breakout au-dessus de l’Asian High.';
      reversalStrength = Math.min(100, Math.round(((curHigh - asianHigh) + (curHigh - lastPrice)) / (2 * (atr || 1e-9)) * 100));
    } else if (sweptLow) {
      amdPhase = 'MANIPULATION'; amdProgress = 70; amdBias = 'BULLISH';
      amdDesc = 'Manipulation : balayage du bas asiatique puis retour dans le range.';
      judasDetected = true; judasSide = 'ASIAN_LOW';
      judasDesc = 'Judas Swing haussier : chasse aux stops sous l’Asian Low.';
      reversalStrength = Math.min(100, Math.round(((asianLow - curLow) + (lastPrice - curLow)) / (2 * (atr || 1e-9)) * 100));
    } else if (lastPrice > asianHigh + 5 * pipSize) {
      amdPhase = 'DISTRIBUTION'; amdProgress = 90; amdBias = 'BULLISH';
      amdDesc = 'Expansion haussière au-dessus du range asiatique.';
    } else if (lastPrice < asianLow - 5 * pipSize) {
      amdPhase = 'DISTRIBUTION'; amdProgress = 90; amdBias = 'BEARISH';
      amdDesc = 'Expansion baissière sous le range asiatique.';
    }
  }

  // ───────── 2. Silver Bullet, calé sur l'heure DE LA BOUGIE et sur l'heure de New York (DST géré) ─────────
  const ny = nyClock(lastMs);
  let sbActive = false;
  let sbName = 'Hors fenêtre Silver Bullet';
  let sbDesc = 'Hors des fenêtres ICT (03h-04h, 10h-11h, 14h-15h heure de New York).';
  if (ny.h === 3) { sbActive = true; sbName = 'London Silver Bullet (03h-04h NY)'; }
  else if (ny.h === 10) { sbActive = true; sbName = 'New York AM Silver Bullet (10h-11h NY)'; }
  else if (ny.h === 14) { sbActive = true; sbName = 'New York PM Silver Bullet (14h-15h NY)'; }
  if (sbActive) sbDesc = `Fenêtre active (${String(ny.h).padStart(2, '0')}:${String(ny.m).padStart(2, '0')} à New York).`;

  // ───────── 3. Direction : uniquement depuis un biais réel (plus de repli sur une SMA) ─────────
  let direction: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  if (amdBias === 'BULLISH') direction = 'BUY';
  else if (amdBias === 'BEARISH') direction = 'SELL';
  const isBuy = direction !== 'SELL';

  // ───────── 4. SMT : vraie comparaison avec une paire corrélée, sinon « non évalué » ─────────
  let smtDetected = false;
  let smtType: SniperSetup['smtDivergence']['divergenceType'] = 'NONE';
  let smtDesc = 'Non évalué : aucune paire corrélée alignée disponible (nécessite le M5 et le scan des paires).';
  const corr = opts.correlated;
  if (corr && corr.closes.length >= 20) {
    const a = candles.slice(-20).map(c => c.close);
    const b = corr.closes.slice(-20);
    const aPrior = a.slice(0, 14), aRecent = a.slice(14);
    const bPrior = b.slice(0, 14), bRecent = b.slice(14);
    const aNewLow = Math.min(...aRecent) < Math.min(...aPrior);
    const bNewLow = Math.min(...bRecent) < Math.min(...bPrior);
    const aNewHigh = Math.max(...aRecent) > Math.max(...aPrior);
    const bNewHigh = Math.max(...bRecent) > Math.max(...bPrior);
    if (aNewLow && !bNewLow) { smtDetected = true; smtType = 'BULLISH_SMT'; }
    else if (aNewHigh && !bNewHigh) { smtDetected = true; smtType = 'BEARISH_SMT'; }
    smtDesc = smtDetected
      ? `Divergence ${smtType === 'BULLISH_SMT' ? 'haussière' : 'baissière'} vs ${corr.label} (approximation sur 20 clôtures).`
      : `Pas de divergence avec ${corr.label}.`;
  }
  const smtEvaluated = !!corr && corr.closes.length >= 20;
  const smtMatches = smtDetected && ((smtType === 'BULLISH_SMT' && direction === 'BUY') || (smtType === 'BEARISH_SMT' && direction === 'SELL'));

  // ───────── 5. Structure + zone d'intérêt (OB / FVG non mitigés) ─────────
  const smc = analyzeStructure(candles, pipSize, isCrypto);
  const structOk = !!smc && direction !== 'WAIT' && biasFromStructure(smc) === direction;
  let poiOk = false;
  let poiDesc = 'Aucune zone d’intérêt dans le sens du trade.';
  if (smc && direction !== 'WAIT') {
    const obs = findOrderBlocks(candles, isBuy ? 'bull' : 'bear', smc.range, pipSize);
    const tol = atr * 0.15;
    const inOB = obs.find(o => !o.mitigated && lastPrice >= o.low - tol && lastPrice <= o.high + tol);
    const fvgs = detectFVG(candles, pipSize, isCrypto);
    const inFVG = fvgs.find(f => !f.mitigated && f.type === (isBuy ? 'bull' : 'bear') && lastPrice >= Math.min(f.top, f.bottom) - tol && lastPrice <= Math.max(f.top, f.bottom) + tol);
    poiOk = !!(inOB || inFVG);
    if (inOB) poiDesc = `Prix dans un Order Block ${isBuy ? 'haussier' : 'baissier'} non mitigé.`;
    else if (inFVG) poiDesc = `Prix dans un FVG ${isBuy ? 'haussier' : 'baissier'}.`;
  }

  // ───────── 6. SL structurel + risque réel en dollars ─────────
  const spreadPips = opts.spreadPips ?? TYPICAL_SPREAD_PIPS[pairId] ?? 1.0;
  const pipValue = opts.pipValueMicroLot ?? PIP_VALUE_MICRO_LOT[pairId] ?? 0.1;
  const recent = candles.slice(-8);
  const swing = isBuy ? Math.min(...recent.map(c => c.low)) : Math.max(...recent.map(c => c.high));
  const structPips = Math.abs(lastPrice - swing) / pipSize + spreadPips * 1.5;
  const slPips = round(Math.max(structPips, spreadPips * 3, (atr * 0.5) / pipSize), 1);

  const entryPrice = lastPrice;
  const px = (pips: number, sign: 1 | -1) => round(entryPrice + sign * pips * pipSize, digits);
  const dirSign: 1 | -1 = isBuy ? 1 : -1;
  const slPrice = px(slPips, (-dirSign) as 1 | -1);
  const tp1Pips = round(slPips * 2.2, 1);
  const tp2Pips = round(slPips * 4.0, 1);
  const tp3Pips = round(slPips * 6.5, 1);
  const bePrice = px(Math.max(1.2, spreadPips * 1.5), dirSign);

  const capitalRiskDollars = round(slPips * pipValue, 2);
  const capitalGainTP1 = round(tp1Pips * pipValue, 2);
  const capitalGainTP2 = round(tp2Pips * pipValue, 2);
  const capitalGainTP3 = round(tp3Pips * pipValue, 2);
  const riskOk = capitalRiskDollars <= maxRiskDollars * 1.5;

  const confluences: SniperConfluence[] = [
    { id: 'judas', name: 'Judas Swing / Manipulation', met: judasDetected, weight: 20, explanation: judasDesc, tag: 'ICT' },
    { id: 'amd', name: 'Cycle AMD', met: amdPhase === 'MANIPULATION' || amdPhase === 'DISTRIBUTION', weight: 15, explanation: amdDesc, tag: 'SMC' },
    { id: 'smt', name: 'Divergence SMT', met: smtMatches, weight: 15, explanation: smtDesc, tag: 'ICT' },
    { id: 'silver_bullet', name: 'Silver Bullet (heure NY)', met: sbActive, weight: 10, explanation: sbDesc, tag: 'TIMING' },
    { id: 'structure', name: 'Structure alignée', met: structOk, weight: 15, explanation: structOk ? 'Le biais de structure confirme la direction.' : 'Structure non alignée ou direction indéterminée.', tag: 'SMC' },
    { id: 'poi', name: 'Zone d’intérêt (OB/FVG)', met: poiOk, weight: 25, explanation: poiDesc, tag: 'SMC' },
    {
      id: 'risk_cap', name: 'Risque ≤ plafond (non noté)', met: riskOk, weight: 0, tag: 'RISK',
      explanation: `SL structurel ${slPips} pips ≈ $${capitalRiskDollars} sur 0,01 lot (plafond $${(maxRiskDollars * 1.5).toFixed(2)}).`
    }
  ];

  const scored = confluences.filter(c => c.weight > 0);
  const score = scored.reduce((acc, c) => acc + (c.met ? c.weight : 0), 0);
  const metCount = scored.filter(c => c.met).length;
  // Une confluence non évaluable (SMT sans paire corrélée) ne doit pas bloquer à elle seule : seuil 4/6 inchangé.
  const planOk = direction === 'WAIT' || isPlanSane(direction, {
    entry: entryPrice, sl: slPrice, tp1: px(tp1Pips, dirSign), tp2: px(tp2Pips, dirSign), tp3: px(tp3Pips, dirSign)
  });
  const isSniperReady = direction !== 'WAIT' && metCount >= 4 && score >= 65 && riskOk && planOk;
  void smtEvaluated;

  let accountSafetyStatus: SniperSetup['accountSafetyStatus'] = 'OPTIMAL';
  if (!riskOk) accountSafetyStatus = 'DANGER_SKIP';
  else if (!isSniperReady) accountSafetyStatus = 'PROTECTED';

  const compoundPlan = {
    currentBalance: accountBalance,
    stepTarget: 1,
    nextBalance: round(accountBalance + capitalGainTP1, 2),
    tradesToDouble: capitalGainTP1 > 0 ? Math.ceil(accountBalance / capitalGainTP1) : 0
  };

  return {
    isSniperReady,
    score,
    direction: isSniperReady ? direction : 'WAIT',
    entryPrice, slPrice,
    tp1Price: px(tp1Pips, dirSign), tp2Price: px(tp2Pips, dirSign), tp3Price: px(tp3Pips, dirSign),
    bePrice,
    riskPips: slPips, tp1Pips, tp2Pips, tp3Pips,
    rrRatio: 2.2,
    recommendedLot: 0.01,
    capitalRiskDollars, capitalGainTP1, capitalGainTP2, capitalGainTP3,
    accountSafetyStatus,
    confluences,
    amd: { phase: amdPhase, progress: amdProgress, description: amdDesc, rangeHigh: asianHigh, rangeLow: asianLow, bias: amdBias },
    judasSwing: { detected: judasDetected, sweptSide: judasSide, reversalStrength, description: judasDesc },
    smtDivergence: { detected: smtDetected, assetCorrelated: corr?.label ?? 'N/A', divergenceType: smtType, description: smtDesc },
    silverBullet: { isActive: sbActive, windowName: sbName, description: sbDesc },
    compoundPlan
  };
}

function createEmptySniper(accountBalance: number): SniperSetup {
  return {
    isSniperReady: false, score: 0, direction: 'WAIT',
    entryPrice: 0, slPrice: 0, tp1Price: 0, tp2Price: 0, tp3Price: 0, bePrice: 0,
    riskPips: 0, tp1Pips: 0, tp2Pips: 0, tp3Pips: 0, rrRatio: 0, recommendedLot: 0.01,
    capitalRiskDollars: 0, capitalGainTP1: 0, capitalGainTP2: 0, capitalGainTP3: 0,
    accountSafetyStatus: 'PROTECTED',
    confluences: [],
    amd: { phase: 'ACCUMULATION', progress: 0, description: 'Données insuffisantes.', rangeHigh: 0, rangeLow: 0, bias: 'NEUTRAL' },
    judasSwing: { detected: false, sweptSide: 'NONE', reversalStrength: 0, description: 'Données insuffisantes.' },
    smtDivergence: { detected: false, assetCorrelated: 'N/A', divergenceType: 'NONE', description: 'Données insuffisantes.' },
    silverBullet: { isActive: false, windowName: 'Hors fenêtre', description: 'Données insuffisantes.' },
    compoundPlan: { currentBalance: accountBalance, stepTarget: 1, nextBalance: accountBalance, tradesToDouble: 0 }
  };
}
