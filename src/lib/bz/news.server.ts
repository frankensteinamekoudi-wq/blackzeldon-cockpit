/**
 * Actualités économiques : données RÉELLES (calendrier Finnhub) ou rien.
 * L'ancienne version renvoyait un faux « NFP dans 45 minutes » et une statistique inventée en permanence.
 */
import { EconomicEvent } from './news-tiers.js';
import { fetchFinnhubEconomicCalendar } from './finnhub.server.js';
import { getSecretKey } from './keystore.server.js';
import { findPairBySymbol } from './config.js';

export interface NewsExposure { currency: string; event: string; phase: 'PRE' | 'POST'; minutes: number }
export interface NewsResponse {
  upcoming: EconomicEvent[];
  recent: EconomicEvent[];
  exposure: NewsExposure[];
  stats: Array<{ sentence: string }>;
  source: 'finnhub' | 'unavailable';
  note?: string;
}

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; key: string; data: NewsResponse } | null = null;

const pad = (n: number) => String(n).padStart(2, '0');

export function buildNewsResponse(events: EconomicEvent[], now = Date.now()): NewsResponse {
  const decorated = events
    .map(e => {
      const t = new Date(e.time).getTime();
      const d = new Date(t);
      return { ...e, minutes: Math.round((t - now) / 60000), localTime: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` };
    })
    .filter(e => Number.isFinite(new Date(e.time).getTime()) && e.impact !== 'low');

  const upcoming = decorated.filter(e => (e.minutes as number) >= -15 && (e.minutes as number) <= 48 * 60).sort((a, b) => (a.minutes as number) - (b.minutes as number)).slice(0, 30);
  const recent = decorated.filter(e => (e.minutes as number) < 0 && (e.minutes as number) >= -6 * 60).sort((a, b) => (b.minutes as number) - (a.minutes as number)).slice(0, 20);

  const exposure: NewsExposure[] = [];
  for (const e of decorated) {
    if (e.impact !== 'high') continue;
    const m = e.minutes as number;
    if (m >= 0 && m <= 30) exposure.push({ currency: e.currency, event: e.event, phase: 'PRE', minutes: m });
    else if (m < 0 && m >= -15) exposure.push({ currency: e.currency, event: e.event, phase: 'POST', minutes: Math.abs(m) });
  }
  return { upcoming, recent, exposure, stats: [], source: 'finnhub' };
}

export async function getEconomicNews(): Promise<NewsResponse> {
  const key = getSecretKey('finnhubApiKey');
  if (!key) {
    return { upcoming: [], recent: [], exposure: [], stats: [], source: 'unavailable', note: 'Clé Finnhub absente : calendrier économique indisponible.' };
  }
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.data;
  const events = await fetchFinnhubEconomicCalendar(key);
  const data: NewsResponse = events.length
    ? buildNewsResponse(events)
    : { upcoming: [], recent: [], exposure: [], stats: [], source: 'unavailable', note: 'Calendrier indisponible (plan Finnhub insuffisant ou erreur réseau).' };
  cache = { at: Date.now(), key, data };
  return data;
}

/** Devises concernées par un symbole (ex. EUR/USD -> EUR, USD ; or, indice, crypto -> USD). */
export function currenciesOf(symbol: string): string[] {
  const pair = findPairBySymbol(symbol);
  if (pair && pair.type === 'fx' && pair.label.includes('/') && !pair.label.startsWith('XAU')) return pair.label.split('/');
  return ['USD'];
}

export async function isSymbolInExposureWindow(symbol: string): Promise<boolean> {
  const ccys = currenciesOf(symbol);
  const data = await getEconomicNews();
  return data.exposure.some(e => ccys.includes(e.currency));
}
