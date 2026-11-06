/** Boucle serveur : ferme automatiquement les trades ouverts en suivant les vrais prix. */
import { db } from './db.server.js';
import { fetchLiveCandlesWithMeta } from './data-engine.server.js';
import { resolveRecord } from './journal-resolver.js';
import { PAIRS } from './config.js';

let running = false;

export async function resolvePendingJournal(): Promise<number> {
  if (running) return 0;
  running = true;
  let closed = 0;
  try {
    const pending = db.getPending();
    if (!pending.length) return 0;
    const byPair = new Map<string, typeof pending>();
    for (const r of pending) byPair.set(r.pair, [...(byPair.get(r.pair) || []), r]);

    for (const [label, recs] of byPair) {
      const pair = PAIRS.find(p => p.label === label);
      if (!pair || !pair.feed) continue;
      const res = await fetchLiveCandlesWithMeta(pair.symbol, '5min', 500);
      if (res.freshness === 'unavailable' || res.freshness === 'simulated' || !res.candles.length) continue;
      for (const rec of recs) {
        const patch = resolveRecord(rec, res.candles);
        if (patch && db.updateJournalResult(rec.client, rec.key, patch)) {
          closed++;
          db.recordDiagnostic('JOURNAL_RESOLVED', label, `${rec.direction} → ${patch.result} (${patch.rMultiple}R)`);
        }
      }
    }
  } catch (e: any) {
    db.recordDiagnostic('JOURNAL_RESOLVER_ERROR', undefined, e?.message);
  } finally {
    running = false;
  }
  return closed;
}

export function startJournalResolver(intervalMs = 60_000) {
  const t = setInterval(() => { void resolvePendingJournal(); }, intervalMs);
  t.unref?.();
  void resolvePendingJournal();
  return t;
}
