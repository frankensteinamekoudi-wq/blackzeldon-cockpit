/**
 * Global Forex & Synthetic Market Sessions and Hours
 */

export interface MarketSession {
  name: string;
  city: string;
  openUTC: number; // Hour in UTC
  closeUTC: number; // Hour in UTC
  active: boolean;
}

export function getGlobalMarketSessions(date: Date = new Date()): MarketSession[] {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;

  const sessions = [
    { name: 'Tokyo / Asie', city: 'Tokyo', openUTC: 0, closeUTC: 9 },
    { name: 'Londres', city: 'London', openUTC: 7, closeUTC: 16 },
    { name: 'New York', city: 'New York', openUTC: 12, closeUTC: 21 },
    { name: 'Sydney', city: 'Sydney', openUTC: 21, closeUTC: 6 }
  ];

  return sessions.map(s => {
    let active = false;
    if (s.openUTC < s.closeUTC) {
      active = utcHours >= s.openUTC && utcHours < s.closeUTC;
    } else {
      active = utcHours >= s.openUTC || utcHours < s.closeUTC;
    }
    return {
      ...s,
      active
    };
  });
}

export function isForexWeekend(date: Date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  // Closes Friday 21:00 UTC, Opens Sunday 21:00 UTC
  if (day === 5 && hour >= 21) return true;
  if (day === 6) return true;
  if (day === 0 && hour < 21) return true;
  return false;
}
