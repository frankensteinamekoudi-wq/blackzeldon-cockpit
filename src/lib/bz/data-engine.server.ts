/**
 * Moteur de données de marché.
 *
 * Règles (corrigées par rapport à l'ancienne version) :
 *  - JAMAIS de bougies aléatoires par défaut. Si aucune source ne répond, on renvoie
 *    freshness = 'unavailable' avec une liste vide. Le simulateur n'existe plus que si
 *    ALLOW_SIMULATOR=true, et il est alors explicitement étiqueté freshness = 'simulated'.
 *  - Le H4 est construit en agrégeant du 1h (Yahoo / Finnhub n'ont pas de 4h natif).
 *  - La fraîcheur est mesurée à partir de l'âge réel de la dernière bougie.
 *  - Symboles inconnus ou sans flux (indices synthétiques) rejetés.
 */
import { Candle } from '../smc/structure.js';
import { db } from './db.server.js';
import { fetchTwelveDataCandles, getTwelveDataQuota } from './twelvedata.server.js';
import { fetchFinnhubForexCandles } from './finnhub.server.js';
import { fetchYahooCandles } from './yahoo.server.js';
import { getSecretKey } from './keystore.server.js';
import { findPairBySymbol, getForexMarketStatus } from './config.js';
import { intervalSeconds, resample, sanitizeCandles, toMs } from './candle-utils.js';

const YAHOO_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'AUD/USD': 'AUDUSD=X',
  // Contrat future or (GC=F) : proche du spot mais avec un léger écart de base / rolls.
  'XAU/USD': 'GC=F',
  'DIA': '^DJI',
  'BTC/USD': 'BTC-USD',
  'ETH/USD': 'ETH-USD'
};

export type Freshness = 'live' | 'stale' | 'unavailable' | 'simulated';
export type DataSource = 'Twelve Data' | 'Finnhub' | 'Yahoo Finance' | 'Simulateur BZ' | 'Aucune';

export interface FetchResult {
  candles: Candle[];
  source: DataSource;
  quotaRemaining?: number;
  freshness: Freshness;
  /** Âge de la dernière bougie en secondes (null si aucune bougie). */
  ageSec: number | null;
  marketClosed: boolean;
  note?: string;
}

const RESULT_CACHE = new Map<string, { at: number; result: FetchResult }>();
const RESULT_TTL_MS = 20_000;

export function computeFreshness(candles: Candle[], interval: string, now = Date.now()): { freshness: Freshness; ageSec: number | null } {
  if (!candles.length) return { freshness: 'unavailable', ageSec: null };
  const last = toMs(candles[candles.length - 1].time);
  if (last === undefined) return { freshness: 'unavailable', ageSec: null };
  const ageSec = Math.max(0, Math.round((now - last) / 1000));
  const iv = intervalSeconds(interval);
  // Une bougie « courante » a jusqu'à 1 intervalle d'âge ; on tolère 2,5 intervalles + 2 min de latence.
  const maxAge = iv >= 86400 ? iv * 5 : iv * 2.5 + 120;
  return { freshness: ageSec <= maxAge ? 'live' : 'stale', ageSec };
}

function unavailable(note: string, marketClosed = false): FetchResult {
  return { candles: [], source: 'Aucune', freshness: 'unavailable', ageSec: null, marketClosed, note };
}

export async function fetchLiveCandlesWithMeta(
  symbol: string,
  interval = '5min',
  outputsize = 100
): Promise<FetchResult> {
  db.touchData();
  outputsize = Math.max(10, Math.min(500, Math.floor(outputsize) || 100));

  const pair = findPairBySymbol(symbol);
  if (!pair) return unavailable('Symbole inconnu.');
  if (!pair.feed) return unavailable(`Aucune source de données branchée pour ${pair.label} (indice synthétique).`);
  const canonical = pair.symbol;

  const cacheKey = `${canonical}|${interval}|${outputsize}`;
  const hit = RESULT_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) return hit.result;

  const marketClosed = pair.type === 'crypto' ? false : (pair.type === 'idx' ? false : !getForexMarketStatus().isOpen);
  const finish = (candles: Candle[], source: DataSource, extra: Partial<FetchResult> = {}): FetchResult => {
    const clean = sanitizeCandles(candles).slice(-outputsize);
    const f = computeFreshness(clean, interval);
    const result: FetchResult = { candles: clean, source, freshness: f.freshness, ageSec: f.ageSec, marketClosed, ...extra };
    RESULT_CACHE.set(cacheKey, { at: Date.now(), result });
    return result;
  };

  const need4h = interval === '4h';

  // 1. Twelve Data (supporte nativement 4h)
  const twelveKey = getSecretKey('twelveDataApiKey');
  if (twelveKey) {
    try {
      const td = await fetchTwelveDataCandles(canonical, interval, twelveKey, outputsize);
      if (td && td.length > 5) {
        const quota = getTwelveDataQuota();
        db.recordDiagnostic('DATA_FETCH_12DATA', canonical, `Twelve Data (${quota.callsLastMinute}/7 appels/min)`);
        return finish(td, 'Twelve Data', { quotaRemaining: 7 - quota.callsLastMinute });
      }
    } catch (err: any) {
      db.recordDiagnostic('DATA_12DATA_FAIL', canonical, err.message);
    }
  }

  const baseInterval = need4h ? '1h' : interval;
  const aggregate = (c: Candle[]) => (need4h ? resample(sanitizeCandles(c), 4 * 3600) : c);

  // 2. Finnhub
  const finnhubKey = getSecretKey('finnhubApiKey');
  if (finnhubKey) {
    try {
      const fh = await fetchFinnhubForexCandles(canonical, baseInterval, finnhubKey);
      if (fh && fh.length > 5) {
        db.recordDiagnostic('DATA_FETCH_FINNHUB', canonical, `Finnhub: ${fh.length} bougies`);
        return finish(aggregate(fh), 'Finnhub');
      }
    } catch (err: any) {
      db.recordDiagnostic('DATA_FINNHUB_FAIL', canonical, err.message);
    }
  }

  // 3. Yahoo Finance
  try {
    const ticker = YAHOO_SYMBOLS[canonical];
    if (ticker) {
      const yf = await fetchYahooCandles(ticker, baseInterval, '5d');
      if (yf && yf.length > 5) {
        db.recordDiagnostic('DATA_FETCH_YAHOO', canonical, `Yahoo Finance: ${yf.length} bougies`);
        return finish(aggregate(yf), 'Yahoo Finance');
      }
    }
  } catch (err: any) {
    db.recordDiagnostic('DATA_YAHOO_FAIL', canonical, err.message);
  }

  // 4. Simulateur : uniquement sur demande explicite, toujours étiqueté.
  if (process.env.ALLOW_SIMULATOR === 'true') {
    const sim = generateSimulatedCandles(canonical, interval, outputsize);
    const result: FetchResult = {
      candles: sim, source: 'Simulateur BZ', freshness: 'simulated', ageSec: 0, marketClosed,
      note: 'DONNÉES SIMULÉES (ALLOW_SIMULATOR=true). Ne jamais trader dessus.'
    };
    return result;
  }

  const result = unavailable('Toutes les sources de données ont échoué (Twelve Data, Finnhub, Yahoo).', marketClosed);
  db.recordDiagnostic('DATA_UNAVAILABLE', canonical, result.note);
  return result;
}

export async function fetchLiveCandles(symbol: string, interval = '5min', outputsize = 100): Promise<Candle[]> {
  return (await fetchLiveCandlesWithMeta(symbol, interval, outputsize)).candles;
}

/** Marche aléatoire de DÉMO. Prix de base indicatifs, sans rapport avec le marché réel. */
function generateSimulatedCandles(symbol: string, interval: string, count: number): Candle[] {
  const bases: Record<string, [number, number]> = {
    'EUR/USD': [1.1, 0.0006], 'GBP/USD': [1.3, 0.0008], 'AUD/USD': [0.65, 0.0005],
    'XAU/USD': [2500, 2.5], 'DIA': [40000, 40], 'BTC/USD': [60000, 220], 'ETH/USD': [2500, 12]
  };
  const [basePrice, volatility] = bases[symbol] || [1, 0.001];
  const stepMs = intervalSeconds(interval) * 1000;
  const now = Date.now();
  let current = basePrice;
  const out: Candle[] = [];
  for (let i = count; i >= 0; i--) {
    const open = current;
    const close = open + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    current = close;
    out.push({ time: new Date(now - i * stepMs).toISOString(), open, high, low, close, volume: 0 });
  }
  return out;
}
