/**
 * News Impact Tiering & Exposure Window Manager.
 */

export interface EconomicEvent {
  event: string;
  currency: string;
  time: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: number | string;
  previous?: number | string;
  actual?: number | string;
  surprise?: number;
  bias?: string;
  tierLabel?: string;
  sourceLabel?: string;
  localTime?: string;
  published?: boolean;
  minutes?: number;
  tier?: string;
  title?: string;
  id?: string;
}

export type EconomicNewsItem = EconomicEvent;

export function evaluateNewsProximity(
  news: EconomicEvent[],
  currencies: string[],
  preMinutes = 30,
  postMinutes = 15
) {
  const now = Date.now();
  for (const item of news) {
    if (item.impact !== 'high') continue;
    if (!currencies.includes(item.currency)) continue;
    const itemTime = new Date(item.time).getTime();
    const diffMin = (itemTime - now) / 60000;

    // Approaching event within window
    if (diffMin >= 0 && diffMin <= preMinutes) {
      return {
        blocked: true,
        phase: 'PRE',
        minutes: Math.round(diffMin),
        event: item.event,
        currency: item.currency
      };
    }
    // Post-release volatility window
    if (diffMin < 0 && Math.abs(diffMin) <= postMinutes) {
      return {
        blocked: true,
        phase: 'POST',
        minutes: Math.round(Math.abs(diffMin)),
        event: item.event,
        currency: item.currency
      };
    }
  }
  return null;
}
