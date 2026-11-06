/**
 * Data Freshness and Stale Signal Evaluator
 * Threshold: 180s for default data freshness
 */

export interface FreshnessStatus {
  isFresh: boolean;
  ageSec: number;
  label: string;
  color: string;
}

export function evaluateDataFreshness(lastTimestamp: number | Date | string | null, thresholdSec: number = 180): FreshnessStatus {
  if (!lastTimestamp) {
    return {
      isFresh: false,
      ageSec: 9999,
      label: 'En attente',
      color: '#94a3b8'
    };
  }

  const ts = typeof lastTimestamp === 'number' ? lastTimestamp : new Date(lastTimestamp).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));

  if (diffSec <= 15) {
    return {
      isFresh: true,
      ageSec: diffSec,
      label: `En direct (${diffSec}s)`,
      color: '#22c55e'
    };
  }

  if (diffSec <= thresholdSec) {
    return {
      isFresh: true,
      ageSec: diffSec,
      label: `Frais (${diffSec}s)`,
      color: '#22d3ee'
    };
  }

  return {
    isFresh: false,
    ageSec: diffSec,
    label: `Différé (${Math.floor(diffSec / 60)}m)`,
    color: '#eab308'
  };
}
