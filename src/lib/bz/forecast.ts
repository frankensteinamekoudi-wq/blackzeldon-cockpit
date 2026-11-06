/**
 * Structure du forecast multi-timeframe.
 * Toutes les valeurs proviennent d'un backtest walk-forward local (voir backtest.ts) : aucune valeur simulée.
 */

export interface ForecastRow {
  tf: '5min' | '15min' | '1h' | '4h';
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  /** Probabilité empirique (0-100) que TP1 (1R structurel) soit touché avant le SL dans l'horizon. */
  probability: number;
  amplitudeAtr: number;
  horizon: number; // bougies
  horizonMinutes: number;
  target: number;
  invalidation: number;
  factors: string[];
  /** Nombre de situations passées comparables (même biais) résolues dans l'historique chargé. */
  similarSamples: number;
  /** Taux de réussite brut observé (0-100). */
  successRate: number;
  resolved: number;
  /** true uniquement si l'échantillon est suffisant (≥ 30). */
  calibrated: boolean;
  dataAgeSec: number | null;
  status?: 'READY' | 'INSUFFICIENT';
}

export interface ForecastResponse {
  symbol: string;
  timestamp: number;
  rows: ForecastRow[];
  source?: string;
  freshness?: string;
  note?: string;
}
