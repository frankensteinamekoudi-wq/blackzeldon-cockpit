/**
 * Résolution des trades du journal : détecte, bougie par bougie, si le SL ou le TP1 a été touché.
 *
 * Hypothèses (documentées, volontairement pessimistes) :
 *  - on ne regarde que les bougies qui s'ouvrent APRÈS l'ouverture du trade ;
 *  - si SL et TP1 sont touchés dans la même bougie, on compte la PERTE (l'ordre intrabougie est inconnu) ;
 *  - un gap au-delà du SL est exécuté au prix d'ouverture de la bougie (R réalisé < -1) ;
 *  - « win » = TP1 atteint (R = distance TP1 / distance SL) ; la gestion TP2/TP3/BE n'est pas modélisée ;
 *  - un trade non résolu après `maxAgeMs` est « expired », valorisé au dernier cours.
 */
import type { Candle } from '../smc/structure.js';
import type { JournalRecord } from './journal-types.js';
import { toMs } from './candle-utils.js';

export const JOURNAL_MAX_AGE_MS = 36 * 3600 * 1000;

export type JournalPatch = Pick<JournalRecord, 'result' | 'rMultiple' | 'exitPrice' | 'closedAt'>;

export function resolveRecord(
  rec: JournalRecord,
  candles: Candle[],
  now = Date.now(),
  maxAgeMs = JOURNAL_MAX_AGE_MS
): JournalPatch | null {
  if (rec.result !== 'pending') return null;
  if (rec.direction !== 'BUY' && rec.direction !== 'SELL') return null;
  const { entry, sl, tp1 } = rec;
  if (entry == null || sl == null || tp1 == null) return null;
  if (![entry, sl, tp1].every(Number.isFinite)) return null;
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return null;
  const isBuy = rec.direction === 'BUY';
  if (isBuy ? !(sl < entry && tp1 > entry) : !(sl > entry && tp1 < entry)) return null;

  const tpR = Math.abs(tp1 - entry) / risk;
  let last: Candle | null = null;

  for (const c of candles) {
    const t = toMs(c.time);
    if (t === undefined || t < rec.timestamp) continue;
    last = c;
    const slHit = isBuy ? c.low <= sl : c.high >= sl;
    const tpHit = isBuy ? c.high >= tp1 : c.low <= tp1;
    if (slHit) {
      // gap : si la bougie s'ouvre déjà au-delà du SL, on sort à l'ouverture
      const gapped = isBuy ? c.open < sl : c.open > sl;
      const exit = gapped ? c.open : sl;
      const r = (isBuy ? exit - entry : entry - exit) / risk;
      return { result: 'loss', rMultiple: round(gapped ? Math.min(r, -1) : -1), exitPrice: exit, closedAt: t };
    }
    if (tpHit) {
      return { result: 'win', rMultiple: round(tpR), exitPrice: tp1, closedAt: t };
    }
  }

  if (now - rec.timestamp > maxAgeMs) {
    const px = last ? last.close : entry;
    const r = (isBuy ? px - entry : entry - px) / risk;
    return { result: 'expired', rMultiple: round(r), exitPrice: px, closedAt: now };
  }
  return null;
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Statistiques réelles à partir des trades clos. */
export function journalStats(records: JournalRecord[]) {
  const closed = records.filter(r => r.result === 'win' || r.result === 'loss');
  const wins = closed.filter(r => r.result === 'win').length;
  const sumR = closed.reduce((s, r) => s + (r.rMultiple ?? (r.result === 'win' ? 1 : -1)), 0);
  return {
    closed: closed.length,
    wins,
    losses: closed.length - wins,
    winRate: closed.length ? wins / closed.length : null,
    expectancyR: closed.length ? sumR / closed.length : null,
    totalR: sumR
  };
}
