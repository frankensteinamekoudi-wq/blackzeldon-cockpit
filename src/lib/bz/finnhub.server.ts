/**
 * Finnhub Market and News Server Module
 * NB : selon le plan Finnhub, les bougies forex peuvent être réservées aux comptes payants.
 * En cas de refus (403) la fonction renvoie [] et le moteur passe à la source suivante.
 */
import { bzFetch } from './http.server.js';
import { EconomicNewsItem } from './news-tiers.js';
import { sanitizeCandles } from './candle-utils.js';
import type { Candle } from '../smc/structure.js';

const FINNHUB_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'OANDA:EUR_USD',
  'GBP/USD': 'OANDA:GBP_USD',
  'AUD/USD': 'OANDA:AUD_USD',
  'XAU/USD': 'OANDA:XAU_USD'
};

const RESOLUTION: Record<string, { res: string; lookbackSec: number }> = {
  '1min': { res: '1', lookbackSec: 86400 * 2 },
  '5min': { res: '5', lookbackSec: 86400 * 4 },
  '15min': { res: '15', lookbackSec: 86400 * 8 },
  '1h': { res: '60', lookbackSec: 86400 * 30 },
  '60min': { res: '60', lookbackSec: 86400 * 30 },
  '1day': { res: 'D', lookbackSec: 86400 * 220 },
  '1week': { res: 'W', lookbackSec: 86400 * 800 }
};

export function finnhubSupports(symbol: string, interval: string): boolean {
  return !!FINNHUB_SYMBOLS[symbol] && !!RESOLUTION[interval];
}

export async function fetchFinnhubForexCandles(
  symbol: string,
  interval: string,
  apiKey?: string
): Promise<Candle[]> {
  if (!apiKey || !finnhubSupports(symbol, interval)) return [];
  const { res: resolution, lookbackSec } = RESOLUTION[interval];
  const now = Math.floor(Date.now() / 1000);
  const url =
    `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(FINNHUB_SYMBOLS[symbol])}` +
    `&resolution=${resolution}&from=${now - lookbackSec}&to=${now}&token=${encodeURIComponent(apiKey)}`;

  try {
    const res = await bzFetch(url, { timeoutMs: 5000, retries: 0 });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.s !== 'ok' || !Array.isArray(json.t)) return [];
    return sanitizeCandles(
      json.t.map((t: number, i: number) => ({
        time: new Date(t * 1000).toISOString(),
        open: json.o[i],
        high: json.h[i],
        low: json.l[i],
        close: json.c[i],
        volume: json.v?.[i] || 0
      }))
    );
  } catch {
    return [];
  }
}

const COUNTRY_TO_CCY: Record<string, string> = {
  US: 'USD', EU: 'EUR', EZ: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  GB: 'GBP', UK: 'GBP', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CA: 'CAD', CH: 'CHF', CN: 'CNY'
};

/** Calendrier économique Finnhub. Renvoie [] si pas de clé / plan insuffisant / erreur. */
export async function fetchFinnhubEconomicCalendar(apiKey?: string): Promise<EconomicNewsItem[]> {
  if (!apiKey) return [];
  const now = new Date();
  const from = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const to = new Date(now.getTime() + 86400000 * 3).toISOString().split('T')[0];
  const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${encodeURIComponent(apiKey)}`;

  try {
    const res = await bzFetch(url, { timeoutMs: 5000, retries: 0 });
    if (!res.ok) return [];
    const data = await res.json();
    const events: any[] = data.economicCalendar || [];

    return events
      .filter(e => e && e.time)
      .map((e, idx) => {
        const impact: 'high' | 'medium' | 'low' =
          e.impact === 'high' ? 'high' : e.impact === 'medium' ? 'medium' : 'low';
        const iso = new Date(String(e.time).replace(' ', 'T') + (String(e.time).includes('Z') ? '' : 'Z')).toISOString();
        return {
          id: `finnhub_${idx}_${e.time}`,
          event: e.event || 'Événement économique',
          title: e.event || 'Événement économique',
          currency: COUNTRY_TO_CCY[String(e.country || 'US').toUpperCase()] || String(e.currency || e.country || 'USD').toUpperCase(),
          time: iso,
          impact,
          tier: impact === 'high' ? 'TIER_1' : impact === 'medium' ? 'TIER_2' : 'TIER_3',
          tierLabel: impact === 'high' ? 'Tier 1 (impact majeur)' : impact === 'medium' ? 'Tier 2' : 'Tier 3',
          sourceLabel: 'Finnhub',
          actual: e.actual != null ? String(e.actual) : undefined,
          forecast: e.estimate != null ? String(e.estimate) : undefined,
          previous: e.prev != null ? String(e.prev) : undefined,
          published: e.actual != null
        } as EconomicNewsItem;
      });
  } catch {
    return [];
  }
}
