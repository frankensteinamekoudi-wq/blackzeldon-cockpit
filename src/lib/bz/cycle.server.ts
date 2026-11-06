import { db } from './db.server.js';
import { getKeysPublicStatus } from './keystore.server.js';
import { getTwelveDataQuota } from './twelvedata.server.js';

export interface SystemState {
  online: boolean;
  executionMode: string;
  heartbeat: ReturnType<typeof db.getHeartbeat>;
  keys: Array<{ slot: number; configured: boolean; available: boolean; creditsUsed: number; creditsLimit: number }>;
  diagnostics: ReturnType<typeof db.getDiagnostics>;
  signals: any[];
}

/** État réel du système : clés effectivement configurées, quota Twelve Data mesuré, derniers trades du journal. */
export function getSystemState(): SystemState {
  const status = getKeysPublicStatus();
  const quota = getTwelveDataQuota();
  const recent = db.getJournalEntries(undefined, 7).sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  return {
    online: true,
    executionMode: 'PAPER (journal)',
    heartbeat: db.getHeartbeat(),
    keys: [
      { slot: 1, configured: status.twelveData.configured, available: quota.available, creditsUsed: quota.callsLastMinute, creditsLimit: quota.callsAllowedPerMinute },
      { slot: 2, configured: status.finnhub.configured, available: status.finnhub.configured, creditsUsed: 0, creditsLimit: 60 }
    ],
    diagnostics: db.getDiagnostics(),
    signals: recent.map(r => ({
      symbol: r.pair,
      direction: r.direction,
      freshness: 'JOURNAL',
      score_initial: r.score,
      score_confirmation: r.score,
      rr: r.rMultiple,
      status: r.result === 'pending' ? 'OPEN' : r.result.toUpperCase(),
      created_at: new Date(r.timestamp).toISOString()
    }))
  };
}
