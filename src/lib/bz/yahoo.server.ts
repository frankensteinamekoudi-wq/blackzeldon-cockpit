/**
 * Yahoo Finance Market Data Server Module
 */
import { bzFetch } from './http.server.js';
import { Candle } from '../smc/structure.js';

export async function fetchYahooCandles(
  ticker: string,
  intervalStr: string = '5m',
  rangeStr: string = '1d'
): Promise<Candle[]> {
  // Map standard intervals
  let yfInterval = '5m';
  if (intervalStr === '1min' || intervalStr === '1m') yfInterval = '1m';
  else if (intervalStr === '5min' || intervalStr === '5m') yfInterval = '5m';
  else if (intervalStr === '15min' || intervalStr === '15m') yfInterval = '15m';
  else if (intervalStr === '1h' || intervalStr === '60min') yfInterval = '60m';
  else if (intervalStr === '1day' || intervalStr === '1d') yfInterval = '1d';
  else if (intervalStr === '1week' || intervalStr === '1wk') yfInterval = '1wk';
  // NB : Yahoo ne fournit pas de 4h. Le moteur de données demande du 1h et rééchantillonne en 4h.

  let yfRange = rangeStr;
  if (yfInterval === '1m') yfRange = '2d';
  else if (yfInterval === '5m' || yfInterval === '15m') yfRange = '5d';
  else if (yfInterval === '60m') yfRange = '3mo';
  else if (yfInterval === '1d') yfRange = '1y';
  else if (yfInterval === '1wk') yfRange = '5y';

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${yfInterval}&range=${yfRange}`;

  try {
    const res = await bzFetch(url, {
      timeoutMs: 6000,
      retries: 1,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Yahoo returned status ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote) return [];

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      if (o != null && h != null && l != null && c != null && !isNaN(c)) {
        candles.push({
          time: new Date(timestamps[i] * 1000).toISOString(),
          open: Number(o),
          high: Number(h),
          low: Number(l),
          close: Number(c),
          volume: Number(volumes[i] || 0)
        });
      }
    }

    return candles;
  } catch (err: any) {
    console.warn(`[Yahoo Data Engine] ${ticker} fetch error:`, err?.message || err);
    return [];
  }
}
