/**
 * Analyse de marché partagée (écran principal, scan des paires, radar multi-timeframes).
 * Une seule implémentation => les chiffres sont cohérents partout (avant : le radar et le scan
 * « simulaient » les autres timeframes / paires avec des multiplicateurs et un hash du nom).
 */
import { analyzeStructure, Candle } from '../smc/structure.js';
import { detectFVG } from '../smc/fvg.js';
import { findOrderBlocks } from '../smc/ob.js';
import { clusterEqualLevels, detectLiquiditySweeps } from '../smc/invalidation.js';
import { calcATR } from '../quantum/edge.js';
import { buildTradePlan, isPlanSane, TradePlan } from './trade-plan.js';
import { ScoreItem, computeDynamicRisk, evaluateQuality, DEFAULT_WEIGHTS } from './scoring.js';
import { biasFromStructure, structuralStop, walkForwardRule, RuleStats } from './backtest.js';
import type { PairConfig, TimeframeConfig } from './config.js';

export interface MarketAnalysis {
  smc: NonNullable<ReturnType<typeof analyzeStructure>>;
  fvgs: ReturnType<typeof detectFVG>;
  obsBull: ReturnType<typeof findOrderBlocks>;
  obsBear: ReturnType<typeof findOrderBlocks>;
  scoreTotal: number;
  scoreItems: ScoreItem[];
  direction: 'BUY' | 'SELL' | 'PAS DE TRADE';
  bias: 'BUY' | 'SELL';
  /** Probabilité EMPIRIQUE (0-1) : backtest walk-forward local, rétréci vers 50 %. */
  probability: number;
  stats: RuleStats;
  quality: string;
  dynamicRisk: number;
  plan: TradePlan | null;
  atr: number;
  lastPrice: number;
  chartZones: Array<{ low: number; high: number; dir: 'bull' | 'bear'; label: string; mitigated?: boolean }>;
}

export function analyzeMarket(
  candles: Candle[],
  pair: Pick<PairConfig, 'pip' | 'type'>,
  tf: Pick<TimeframeConfig, 'atrP'>,
  opts: { withStats?: boolean } = {}
): MarketAnalysis | null {
  if (!candles || candles.length < 15) return null;

  const pip = pair.pip;
  const isCrypto = pair.type === 'crypto';
  const smc = analyzeStructure(candles, pip, isCrypto);
  if (!smc) return null;

  const bias = biasFromStructure(smc);
  const isBuy = bias === 'BUY';

  const fvgs = detectFVG(candles, pip, isCrypto);
  const obsBull = findOrderBlocks(candles, 'bull', smc.range, pip);
  const obsBear = findOrderBlocks(candles, 'bear', smc.range, pip);
  const sweeps = detectLiquiditySweeps(candles, smc.rHigh, smc.rLow);
  clusterEqualLevels(smc.swingHighs, smc.range * 0.12);
  const atr = calcATR(candles, tf.atrP);
  const lastPrice = candles[candles.length - 1].close;

  const items: ScoreItem[] = [];
  const push = (label: string, ok: boolean, detail: string, key: keyof typeof DEFAULT_WEIGHTS) =>
    items.push({ label, ok, detail, pts: ok ? DEFAULT_WEIGHTS[key] : 0, max: DEFAULT_WEIGHTS[key], cat: 'SMC' });

  // 1. BOS dans le sens du biais
  const bosOk = smc.bos === (isBuy ? 'haussier' : 'baissier');
  push('BOS (Structure)', bosOk, smc.bos ? `BOS ${smc.bos}` : 'Dans range', 'bos');

  // 2. CHoCH : seul un CHoCH qui DÉFINIT le biais compte (avant : un CHoCH contraire ajoutait des points)
  const chochOk = smc.choch !== null;
  push('CHoCH Caractère', chochOk, smc.choch ? `CHoCH ${smc.choch} (biais renversé)` : 'Aucun', 'choch');

  // 3. Zone Premium / Discount (0 point si faux — avant : 4 points offerts)
  const zoneOk = (isBuy && smc.zone === 'Discount') || (!isBuy && smc.zone === 'Premium');
  push('Zone P/D', zoneOk, smc.zone, 'zone');

  // 4. Order Block dans le sens du biais
  const bestOB = isBuy ? obsBull[0] : obsBear[0];
  const obOk = bestOB !== undefined && bestOB.score >= 5;
  push('Order Block', obOk, bestOB ? `Score ${bestOB.score}/10` : 'Aucun bloc clair', 'ob');

  // 5. FVG dans le sens du biais
  const fvgOk = fvgs.some(f => f.type === (isBuy ? 'bull' : 'bear'));
  push('FVG Inbalance', fvgOk, `${fvgs.length} zones actives`, 'fvg');

  // 6. Sweep de liquidité
  const sweepOk = sweeps.sweep !== null;
  push('Sweep Liquidité', sweepOk, sweeps.sweep || 'Aucun balayage', 'sweep');

  // 7. OTE
  const oteLow = smc.rLow + smc.range * 0.618;
  const oteHigh = smc.rLow + smc.range * 0.786;
  const inOTE = lastPrice >= oteLow && lastPrice <= oteHigh;
  push('Fibonacci OTE', inOTE, inOTE ? 'Zone 61.8% - 78.6%' : 'Hors zone', 'ote');

  const rawTotal = items.reduce((s, it) => s + it.pts, 0);
  const maxTotal = items.reduce((s, it) => s + it.max, 0) || 1;
  // Normalisé sur 100 (le total brut possible est 133 : l'ancien plafond à 96 écrasait le haut de l'échelle)
  const scoreTotal = Math.round((rawTotal / maxTotal) * 100);

  const direction: MarketAnalysis['direction'] = scoreTotal >= 40 ? bias : 'PAS DE TRADE';

  const stats = walkForwardRule(candles, {
    dir: bias,
    pipSize: pip,
    isCrypto,
    atrPeriod: tf.atrP,
    step: opts.withStats === false ? 6 : 2
  });
  const probability = stats.shrunk;

  const dynamicRisk = computeDynamicRisk(scoreTotal, probability);
  const quality = evaluateQuality(scoreTotal, probability);

  const rawPlan = direction !== 'PAS DE TRADE'
    ? buildTradePlan(direction, lastPrice, atr, pip, structuralStop(smc, direction))
    : null;
  // Jamais de plan incohérent (SL et TP du même côté, mauvais ordre…) : on préfère ne rien afficher.
  const plan = rawPlan && direction !== 'PAS DE TRADE' && isPlanSane(direction, { entry: rawPlan.entryA, sl: rawPlan.sl, tp1: rawPlan.tp1, tp2: rawPlan.tp2, tp3: rawPlan.tp3 }) ? rawPlan : null;

  const chartZones: MarketAnalysis['chartZones'] = [
    ...obsBull.slice(0, 2).map(o => ({ low: o.low, high: o.high, dir: 'bull' as const, label: 'OB Bull', mitigated: o.mitigated })),
    ...obsBear.slice(0, 2).map(o => ({ low: o.low, high: o.high, dir: 'bear' as const, label: 'OB Bear', mitigated: o.mitigated })),
    ...fvgs.slice(0, 2).map(f => ({ low: Math.min(f.top, f.bottom), high: Math.max(f.top, f.bottom), dir: f.type as 'bull' | 'bear', label: 'FVG' }))
  ];

  return { smc, fvgs, obsBull, obsBear, scoreTotal, scoreItems: items, direction, bias, probability, stats, quality, dynamicRisk, plan, atr, lastPrice, chartZones };
}
