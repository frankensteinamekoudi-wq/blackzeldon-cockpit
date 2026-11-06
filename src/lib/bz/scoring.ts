/**
 * Blackzeldon Scoring Engine - SMC Confluence, Bayesian Evaluation & Dynamic Risk.
 */

export interface ScoreItem {
  label: string;
  ok: boolean;
  detail: string;
  pts: number;
  max: number;
  cat: string;
}

export const DEFAULT_WEIGHTS: Record<string, number> = {
  bos: 30,
  choch: 25,
  zone: 12,
  sweep: 20,
  ob: 18,
  fvg: 18,
  rsi: 5,
  macd: 5,
  trend: 8,
  bb: 6,
  pattern: 6,
  ote: 10,
  manipulation: 15,
  volume: 10,
  cascade: 15,
  liquidity: 10,
  exchange: 10,
  eqhl: 12,
  midnight: 8,
  vsa: 14
};

/**
 * Risque par trade (% du capital) — volontairement prudent et basé sur deux choses mesurables :
 * le score de confluence et la probabilité EMPIRIQUE (backtest local). Aucune entrée « décorative ».
 *  - probabilité < 50 % (espérance négative à 1R:1R) => 0,5 % ;
 *  - sinon 1 % par défaut, 1,5 % si score ≥ 75 et prob ≥ 55 %, 2 % si score ≥ 80 et prob ≥ 60 %.
 */
export function computeDynamicRisk(scoreTotal: number, prob: number): number {
  let riskPercent = 1.0;
  if (prob < 0.5 || scoreTotal < 55) riskPercent = 0.5;
  else if (scoreTotal >= 80 && prob >= 0.6) riskPercent = 2.0;
  else if (scoreTotal >= 75 && prob >= 0.55) riskPercent = 1.5;
  return riskPercent;
}

export function evaluateQuality(scoreTotal: number, finalProb: number): string {
  if (scoreTotal >= 75 && finalProb >= 0.6) return "Excellent";
  if (scoreTotal >= 60 && finalProb >= 0.54) return "Bon";
  if (scoreTotal >= 50 && finalProb >= 0.5) return "Modéré";
  return "Faible";
}
