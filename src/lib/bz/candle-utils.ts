/**
 * Utilitaires bougies : conversion du temps, durée d'un intervalle, rééchantillonnage,
 * nettoyage. Pur (aucune dépendance Node) : utilisable côté client et serveur.
 */
import type { Candle } from '../smc/structure.js';

export function toMs(t: string | number | undefined | null): number | undefined {
  if (t == null) return undefined;
  if (typeof t === 'number') {
    if (!Number.isFinite(t)) return undefined;
    return t < 1e12 ? t * 1000 : t; // secondes -> ms
  }
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : undefined;
}

const INTERVAL_SEC: Record<string, number> = {
  '1min': 60, '5min': 300, '15min': 900, '30min': 1800,
  '1h': 3600, '60min': 3600, '4h': 14400, '1day': 86400, '1week': 604800
};

export function intervalSeconds(interval: string): number {
  return INTERVAL_SEC[interval] ?? 300;
}

/** Retire les bougies invalides, trie par temps croissant, supprime les doublons. */
export function sanitizeCandles(candles: Candle[]): Candle[] {
  const seen = new Set<number>();
  const out: Candle[] = [];
  for (const raw of candles) {
    const t = toMs(raw.time);
    if (t === undefined) continue;
    if (![raw.open, raw.high, raw.low, raw.close].every(Number.isFinite)) continue;
    // enveloppe incohérente : on la répare plutôt que de jeter la bougie
    const c: Candle = {
      ...raw,
      high: Math.max(raw.high, raw.open, raw.close),
      low: Math.min(raw.low, raw.open, raw.close)
    };
    if (seen.has(t)) continue;
    seen.add(t);
    out.push({ ...c, time: new Date(t).toISOString() });
  }
  out.sort((a, b) => (toMs(a.time) as number) - (toMs(b.time) as number));
  return out;
}

/** Agrège des bougies fines (ex. 1h) en bougies plus larges (ex. 4h), alignées sur l'UTC. */
export function resample(candles: Candle[], bucketSeconds: number): Candle[] {
  const bucketMs = bucketSeconds * 1000;
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let curBucket = -1;
  for (const c of candles) {
    const t = toMs(c.time);
    if (t === undefined) continue;
    const b = Math.floor(t / bucketMs) * bucketMs;
    if (!cur || b !== curBucket) {
      if (cur) out.push(cur);
      curBucket = b;
      cur = { time: new Date(b).toISOString(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 };
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume = (cur.volume || 0) + (c.volume || 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}
