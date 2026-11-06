/**
 * Dynamic Risk Labeling and Sizing Category
 */

export type RiskLevel = 'FAIBLE' | 'MODÉRÉ' | 'ÉLEVÉ' | 'EXTRÊME' | 'SURVIE';

export interface RiskEvaluation {
  level: RiskLevel;
  color: string;
  maxRiskPct: number;
  recommendation: string;
}

export function evaluateRiskCategory(
  atrRatio: number,
  tailRiskCVaR95: number,
  spreadPips: number
): RiskEvaluation {
  if (atrRatio > 2.5 || tailRiskCVaR95 < -0.04) {
    return {
      level: 'SURVIE',
      color: '#ef4444',
      maxRiskPct: 0.5,
      recommendation: 'Volatilité anormale ou choc de liquidité imminent. Réduction maximale.'
    };
  }

  if (atrRatio > 1.8 || tailRiskCVaR95 < -0.025 || spreadPips > 3.0) {
    return {
      level: 'EXTRÊME',
      color: '#f97316',
      maxRiskPct: 1.0,
      recommendation: 'Mouvement rapide attendu, resserrer les stops ou diviser le lot.'
    };
  }

  if (atrRatio > 1.3 || tailRiskCVaR95 < -0.015) {
    return {
      level: 'ÉLEVÉ',
      color: '#eab308',
      maxRiskPct: 1.5,
      recommendation: 'Conditions volatiles régulières. Risque modéré conseillé.'
    };
  }

  if (atrRatio > 0.8) {
    return {
      level: 'MODÉRÉ',
      color: '#22d3ee',
      maxRiskPct: 2.0,
      recommendation: 'Marché normal, exécution standard du plan de trading.'
    };
  }

  return {
    level: 'FAIBLE',
    color: '#22c55e',
    maxRiskPct: 2.5,
    recommendation: 'Faible volatilité, compression propice à une expansion imminente.'
  };
}
