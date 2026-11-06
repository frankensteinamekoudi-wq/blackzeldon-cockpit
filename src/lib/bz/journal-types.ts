/** Types du journal de trades (partagés client / serveur, sans dépendance Node). */
export interface JournalRecord {
  key: string;
  client: string;
  pair: string;
  timeframe: string;
  direction: 'BUY' | 'SELL' | null;
  score: number | null;
  /** Probabilité empirique (backtest local, rétrécie) – null si non calculée. */
  probability: number | null;
  entry: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  result: 'win' | 'loss' | 'expired' | 'pending';
  /** R planifié tant que le trade est ouvert, R réalisé une fois clos. */
  rMultiple: number | null;
  exitPrice: number | null;
  timestamp: number;
  closedAt: number | null;
  quality: string | null;
}
