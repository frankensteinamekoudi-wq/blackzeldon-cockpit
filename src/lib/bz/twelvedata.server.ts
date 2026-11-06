/**
 * Twelve Data High-Priority Engine with Strict 8 req/min Quota Guard
 */
import { Candle } from '../smc/structure.js';
import { bzFetch } from './http.server.js';
import { db } from './db.server.js';

interface TwelveDataCacheItem {
  timestamp: number;
  candles: Candle[];
}

const CACHE = new Map<string, TwelveDataCacheItem>();
const CACHE_TTL_MS = 45 * 1000; // 45 seconds cache per symbol/interval

// Twelve Data Free Tier Quota: max 8 calls per 60 seconds
const CALL_TIMESTAMPS: number[] = [];
const MAX_CALLS_PER_MINUTE = 7; // Safe ceiling below the 8 hard limit

export interface TwelveDataQuotaStatus {
  callsLastMinute: number;
  callsAllowedPerMinute: number;
  available: boolean;
  secondsUntilNextSlot: number;
}

export function getTwelveDataQuota(): TwelveDataQuotaStatus {
  const now = Date.now();
  // Clear calls older than 60 seconds
  while (CALL_TIMESTAMPS.length > 0 && now - CALL_TIMESTAMPS[0] > 60000) {
    CALL_TIMESTAMPS.shift();
  }

  const callsLastMinute = CALL_TIMESTAMPS.length;
  const available = callsLastMinute < MAX_CALLS_PER_MINUTE;
  const oldestCall = CALL_TIMESTAMPS[0];
  const secondsUntilNextSlot = oldestCall ? Math.max(0, Math.ceil((60000 - (now - oldestCall)) / 1000)) : 0;

  return {
    callsLastMinute,
    callsAllowedPerMinute: MAX_CALLS_PER_MINUTE,
    available,
    secondsUntilNextSlot
  };
}

export async function fetchTwelveDataCandles(
  symbol: string,
  intervalStr: string = '5min',
  apiKey?: string,
  outputsize = 100
): Promise<Candle[] | null> {
  const key = apiKey || process.env.TWELVE_DATA_API_KEY;
  if (!key || key.trim() === '') {
    return null; // No key configured
  }

  const cacheKey = `${symbol}_${intervalStr}_${outputsize}`;
  const cached = CACHE.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.candles;
  }

  // Check quota
  const quota = getTwelveDataQuota();
  if (!quota.available) {
    db.recordDiagnostic(
      'TWELVE_DATA_QUOTA_GUARD',
      symbol,
      `Quota 8 req/min atteint (${quota.callsLastMinute}/8). Passage automatique au relais Finnhub/Yahoo sans erreur.`
    );
    // If we have stale cache, return it rather than failing
    if (cached) return cached.candles;
    return null;
  }

  // Format symbol for Twelve Data: e.g. "EUR/USD"
  let cleanSymbol = symbol;
  if (symbol.includes('/')) {
    cleanSymbol = symbol;
  } else if (symbol.length === 6 && !symbol.includes('-')) {
    cleanSymbol = `${symbol.substring(0, 3)}/${symbol.substring(3, 6)}`;
  } else if (symbol === 'XAUUSD') {
    cleanSymbol = 'XAU/USD';
  } else if (symbol === 'BTCUSD') {
    cleanSymbol = 'BTC/USD';
  }

  // Format interval: 1min, 5min, 15min, 1h, 4h, 1day
  let tdInterval = intervalStr;
  if (intervalStr === '60min') tdInterval = '1h';

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(cleanSymbol)}&interval=${tdInterval}&outputsize=${outputsize}&apikey=${key.trim()}`;

  try {
    CALL_TIMESTAMPS.push(now);

    const res = await bzFetch(url, { timeoutMs: 6000, retries: 0 });
    if (!res.ok) {
      throw new Error(`Twelve Data HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.status === 'error' || !Array.isArray(data.values)) {
      db.recordDiagnostic('TWELVE_DATA_ERROR', symbol, data.message || 'Status non ok');
      return null;
    }

    const values = data.values;
    const candles: Candle[] = [];

    // Twelve Data returns newest first, so we reverse
    for (let i = values.length - 1; i >= 0; i--) {
      const v = values[i];
      const o = parseFloat(v.open);
      const h = parseFloat(v.high);
      const l = parseFloat(v.low);
      const c = parseFloat(v.close);
      const vol = parseFloat(v.volume || '0');

      if (!isNaN(o) && !isNaN(h) && !isNaN(l) && !isNaN(c)) {
        candles.push({
          time: new Date(v.datetime).toISOString(),
          open: o,
          high: h,
          low: l,
          close: c,
          volume: vol
        });
      }
    }

    if (candles.length > 5) {
      CACHE.set(cacheKey, { timestamp: now, candles });
      db.recordDiagnostic(
        'TWELVE_DATA_SUCCESS',
        symbol,
        `${candles.length} bougies reçues en direct (${quota.callsLastMinute + 1}/8 appels/min)`
      );
      return candles;
    }

    return null;
  } catch (err: any) {
    db.recordDiagnostic('TWELVE_DATA_EXCEPTION', symbol, err.message);
    return null;
  }
}
