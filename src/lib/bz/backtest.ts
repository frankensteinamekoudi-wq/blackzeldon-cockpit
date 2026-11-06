/**
 * Backtest « walk-forward » de la règle de trading du cockpit.
 *
 * Idée : au lieu d'inventer une « probabilité », on mesure ce que la MÊME règle
 * (biais SMC + plan ATR/structure) aurait donné sur l'historique chargé :
 *   à chaque bougie i : analyse sur l'historique ≤ i uniquement (pas de regard vers le futur),
 *   construction du plan (SL structurel, TP1 = 1R), puis on regarde si TP1 ou SL est touché
 *   dans les `horizon` bougies suivantes (mèches incluses ; si les deux dans la même bougie => perte).
 * Les échantillons se chevauchent (autocorrélés) : le résultat est une ESTIMATION, pas une preuve.
 * Les coûts (spread / slippage) ne sont pas modélisés : l'espérance réelle est plus basse.
 */
import { analyzeStructure, Candle, SMCStructureResult } from '../smc/structure.js';
import { calcATR } from '../quantum/edge.js';
import { buildTradePlan, TradePlan } from './trade-plan.js';

export type Dir = 'BUY' | 'SELL';

/** Biais directionnel : un CHoCH récent prime sur la structure précédente (il en marque le renversement). */
export function biasFromStructure(smc: SMCStructureResult): Dir {
  if (smc.choch === 'haussier') return 'BUY';
  if (smc.choch === 'baissier') return 'SELL';
  return smc.structure === 'Haussier' ? 'BUY' : 'SELL';
}

export function structuralStop(smc: SMCStructureResult, dir: Dir): number | undefined {
  const arr = dir === 'BUY' ? smc.swingLows : smc.swingHighs;
  if (!arr.length) return undefined;
  return arr[arr.length - 1].price;
}

export function planFor(history: Candle[], dir: Dir, pipSize: number, isCrypto: boolean, atrPeriod = 14): TradePlan {
  const smc = analyzeStructure(history, pipSize, isCrypto);
  const atr = calcATR(history, atrPeriod);
  const entry = history[history.length - 1].close;
  return buildTradePlan(dir, entry, atr, pipSize, smc ? structuralStop(smc, dir) : undefined);
}

export interface RuleStats {
  samples: number;      // trades résolus (gagnés + perdus)
  wins: number;
  losses: number;
  timeouts: number;     // ni TP1 ni SL dans l'horizon (exclus du taux)
  rate: number;         // taux brut de réussite (0.5 si aucun échantillon)
  shrunk: number;       // taux rétréci vers 50 % (prior Beta(5,5)) — c'est lui qu'on affiche
  expectancyR: number;  // espérance brute en R (TP1 = 1R), hors coûts
}

export interface WalkForwardOptions {
  dir?: Dir;            // ne garder que les moments où le biais == dir
  pipSize: number;
  isCrypto: boolean;
  horizon?: number;
  minHistory?: number;
  maxHistory?: number;
  step?: number;
  atrPeriod?: number;
}

const PRIOR = 5;

export function walkForwardRule(candles: Candle[], o: WalkForwardOptions): RuleStats {
  const horizon = o.horizon ?? 50;
  const minHistory = o.minHistory ?? 40;
  const maxHistory = o.maxHistory ?? 120;
  const step = Math.max(1, o.step ?? 2);
  let wins = 0, losses = 0, timeouts = 0;

  for (let i = minHistory; i < candles.length - 2; i += step) {
    const history = candles.slice(Math.max(0, i - maxHistory + 1), i + 1);
    const smc = analyzeStructure(history, o.pipSize, o.isCrypto);
    if (!smc) continue;
    const dir = biasFromStructure(smc);
    if (o.dir && dir !== o.dir) continue;
    const plan = planFor(history, dir, o.pipSize, o.isCrypto, o.atrPeriod ?? 14);
    const isBuy = dir === 'BUY';
    let outcome: 'win' | 'loss' | 'timeout' = 'timeout';
    const end = Math.min(candles.length - 1, i + horizon);
    for (let j = i + 1; j <= end; j++) {
      const c = candles[j];
      const slHit = isBuy ? c.low <= plan.sl : c.high >= plan.sl;
      const tpHit = isBuy ? c.high >= plan.tp1 : c.low <= plan.tp1;
      if (slHit) { outcome = 'loss'; break; } // SL prioritaire si les deux dans la même bougie
      if (tpHit) { outcome = 'win'; break; }
    }
    if (outcome === 'win') wins++;
    else if (outcome === 'loss') losses++;
    else timeouts++;
  }

  const samples = wins + losses;
  return {
    samples,
    wins,
    losses,
    timeouts,
    rate: samples ? wins / samples : 0.5,
    shrunk: (wins + PRIOR) / (samples + 2 * PRIOR),
    expectancyR: samples ? (wins - losses) / samples : 0
  };
}
