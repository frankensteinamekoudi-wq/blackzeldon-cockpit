/**
 * Market Helper Functions for Client Cockpit
 */
import { PairConfig } from './config.js';
import { isForexWeekend } from './markets.js';

export function getPairDisplayStatus(pair: PairConfig, now: Date = new Date()): { label: string; active: boolean; badgeColor: string } {
  if (pair.type === 'crypto' || pair.type === 'synthetic') {
    return { label: '24/7 Ouvert', active: true, badgeColor: 'bg-emerald-500/20 text-emerald-400' };
  }

  const isWeekend = isForexWeekend(now);
  if (isWeekend) {
    return { label: 'Week-end Fermé', active: false, badgeColor: 'bg-rose-500/20 text-rose-400' };
  }

  return { label: 'Forex Ouvert', active: true, badgeColor: 'bg-cyan-500/20 text-cyan-400' };
}
