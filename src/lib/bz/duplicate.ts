/**
 * Signal Deduplication Module
 * Prevents multiple identical signals on the same pair/timeframe within cool-down window
 */

export interface TrackedSignal {
  id: string;
  pair: string;
  timeframe: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  timestamp: number;
}

const RECENT_SIGNALS = new Map<string, TrackedSignal>();
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

export function isDuplicateSignal(
  pair: string,
  timeframe: string,
  direction: 'BUY' | 'SELL',
  entry: number,
  sl: number,
  pipSize: number = 0.0001,
  tolerancePips: number = 5
): boolean {
  const key = `${pair}_${timeframe}_${direction}`;
  const existing = RECENT_SIGNALS.get(key);
  const now = Date.now();

  if (!existing) return false;

  // Window expired?
  if (now - existing.timestamp > DUPLICATE_WINDOW_MS) {
    RECENT_SIGNALS.delete(key);
    return false;
  }

  // Check price proximity
  const diffPips = Math.abs(existing.entry - entry) / pipSize;
  if (diffPips < tolerancePips) {
    return true; // Duplicate!
  }

  return false;
}

export function registerSignal(
  pair: string,
  timeframe: string,
  direction: 'BUY' | 'SELL',
  entry: number,
  sl: number
): void {
  const key = `${pair}_${timeframe}_${direction}`;
  RECENT_SIGNALS.set(key, {
    id: `sig_${Date.now()}`,
    pair,
    timeframe,
    direction,
    entry,
    sl,
    timestamp: Date.now()
  });
}
