/**
 * Blackzeldon Engine - Configuration des Paires, Timeframes et Kill Zones
 */

export interface PairConfig {
  id: string;
  label: string;
  symbol: string;
  digits: number;
  pip: number;
  type: 'fx' | 'idx' | 'crypto' | 'synthetic';
  icon: string;
  theme: string;
  /** true si une source de données réelle existe pour ce symbole (Twelve Data / Finnhub / Yahoo). */
  feed: boolean;
}

const RAW_PAIRS: Omit<PairConfig, 'feed'>[] = [
  { id: "EURUSD", label: "EUR/USD", symbol: "EUR/USD", digits: 5, pip: 0.0001, type: "fx", icon: "💶", theme: "#22d3ee" },
  { id: "GBPUSD", label: "GBP/USD", symbol: "GBP/USD", digits: 5, pip: 0.0001, type: "fx", icon: "💷", theme: "#22d3ee" },
  { id: "AUDUSD", label: "AUD/USD", symbol: "AUD/USD", digits: 5, pip: 0.0001, type: "fx", icon: "🦘", theme: "#22d3ee" },
  { id: "XAUUSD", label: "XAU/USD", symbol: "XAU/USD", digits: 2, pip: 0.1,    type: "fx", icon: "🥇", theme: "#eab308" },
  { id: "US30",   label: "US 30",   symbol: "DIA",     digits: 1, pip: 1,      type: "idx", icon: "📈", theme: "#8b5cf6" },
  { id: "BTCUSD", label: "BTC/USD", symbol: "BTC/USD", digits: 2, pip: 1,      type: "crypto", icon: "₿", theme: "#f97316" },
  { id: "ETHUSD", label: "ETH/USD", symbol: "ETH/USD", digits: 2, pip: 0.1,    type: "crypto", icon: "Ξ", theme: "#8b5cf6" },
  // Synthétiques
  { id: "VIX75",    label: "Volatility 75",  symbol: "R_75",     digits: 3, pip: 0.001, type: "synthetic", icon: "🔮", theme: "#8b5cf6" },
  { id: "VIX100",   label: "Volatility 100", symbol: "R_100",    digits: 3, pip: 0.001, type: "synthetic", icon: "⚡", theme: "#a78bfa" },
  { id: "BOOM500",  label: "Boom 500",       symbol: "BOOM500",  digits: 1, pip: 0.1,   type: "synthetic", icon: "📈", theme: "#22c55e" },
  { id: "BOOM1000", label: "Boom 1000",      symbol: "BOOM1000", digits: 2, pip: 0.01,  type: "synthetic", icon: "📈", theme: "#22c55e" },
  { id: "CRASH500", label: "Crash 500",      symbol: "CRASH500", digits: 1, pip: 0.1,   type: "synthetic", icon: "📉", theme: "#ef4444" },
  { id: "CRASH1000",label: "Crash 1000",     symbol: "CRASH1000",digits: 2, pip: 0.01,  type: "synthetic", icon: "📉", theme: "#ef4444" },
  { id: "STEPIDX",  label: "Step Index",     symbol: "stpRNG",   digits: 2, pip: 0.01,  type: "synthetic", icon: "📊", theme: "#eab308" },
  { id: "RANGE100", label: "Range 100",      symbol: "RDBULL",   digits: 2, pip: 0.01,  type: "synthetic", icon: "↔️", theme: "#22d3ee" },
  { id: "JUMP10",   label: "Jump 10",        symbol: "JD10",     digits: 2, pip: 0.01,  type: "synthetic", icon: "🚀", theme: "#f97316" },
  { id: "BEAR200",  label: "Bear 200",       symbol: "BEAR",     digits: 2, pip: 0.01,  type: "synthetic", icon: "🐻", theme: "#ec4899" }
];

/**
 * Les indices synthétiques (Deriv : Boom/Crash/Volatility…) n'ont AUCUNE source de données
 * branchée dans ce projet. Ils sont donc marqués feed=false : pas d'analyse, pas de signal,
 * pas d'auto-trade (avant : ils tournaient sur des bougies aléatoires).
 */
export const PAIRS: PairConfig[] = RAW_PAIRS.map(p => ({ ...p, feed: p.type !== 'synthetic' }));

export function findPairBySymbol(symbolOrLabel: string): PairConfig | undefined {
  const clean = symbolOrLabel.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return PAIRS.find(p =>
    p.symbol === symbolOrLabel || p.label === symbolOrLabel || p.id === clean ||
    p.symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase() === clean
  );
}

export function isKnownSymbol(symbol: string): boolean {
  const p = findPairBySymbol(symbol);
  return !!p && p.feed;
}

/** Paires corrélées positivement, utilisées pour la divergence SMT du mode Sniper. */
export const SMT_CORRELATION: Record<string, { id: string; label: string }> = {
  EURUSD: { id: 'GBPUSD', label: 'GBP/USD' },
  GBPUSD: { id: 'EURUSD', label: 'EUR/USD' },
  AUDUSD: { id: 'EURUSD', label: 'EUR/USD' },
  BTCUSD: { id: 'ETHUSD', label: 'ETH/USD' },
  ETHUSD: { id: 'BTCUSD', label: 'BTC/USD' }
};

/** Spread typique (en pips de la paire) – sert de plancher réaliste au Stop Loss. Estimation. */
export const TYPICAL_SPREAD_PIPS: Record<string, number> = {
  EURUSD: 1.0, GBPUSD: 1.3, AUDUSD: 1.3, XAUUSD: 2.5, US30: 2.0, BTCUSD: 20, ETHUSD: 2.0
};

/** Valeur d'un pip pour 0,01 lot en $ (estimation – à vérifier chez ton courtier). */
export const PIP_VALUE_MICRO_LOT: Record<string, number> = {
  EURUSD: 0.10, GBPUSD: 0.10, AUDUSD: 0.10, XAUUSD: 0.10, US30: 0.01, BTCUSD: 0.01, ETHUSD: 0.001
};


export interface TimeframeConfig {
  id: string;
  label: string;
  apiInterval: string;
  role: string;
  outputsize: number;
  cacheSec: number;
  atrP: number;
}

export const TF_LIST: TimeframeConfig[] = [
  { id: "1min",  label: "M1",  apiInterval: "1min",  role: "scalp",     outputsize: 80,  cacheSec: 30,   atrP: 14 },
  { id: "5min",  label: "M5",  apiInterval: "5min",  role: "entrée",    outputsize: 100, cacheSec: 60,   atrP: 14 },
  { id: "15min", label: "M15", apiInterval: "15min", role: "setup",     outputsize: 100, cacheSec: 180,  atrP: 14 },
  { id: "1h",    label: "H1",  apiInterval: "1h",    role: "biais",     outputsize: 80,  cacheSec: 300,  atrP: 14 },
  { id: "4h",    label: "H4",  apiInterval: "4h",    role: "structure", outputsize: 60,  cacheSec: 2400, atrP: 14 },
  { id: "1day",  label: "D1",  apiInterval: "1day",  role: "daily",     outputsize: 60,  cacheSec: 2400, atrP: 10 },
  { id: "1week", label: "W1",  apiInterval: "1week", role: "weekly",    outputsize: 30,  cacheSec: 2400, atrP: 10 },
];

export const TF_LIST_RADAR = TF_LIST.slice(0, 6);

export interface KillZone {
  id: string;
  label: string;
  fullName: string;
  emoji: string;
  color: string;
  start: number; // minutes from 00:00 UTC
  end: number;
  purpose: string;
}

export const KILL_ZONES: KillZone[] = [
  {
    id: "asia",
    label: "Asie KZ",
    fullName: "Asian Range Accumulation",
    emoji: "🌏",
    color: "#a855f7",
    start: 0,
    end: 240, // 00:00 - 04:00 UTC
    purpose: "Établissement du range initial (Asian High & Low). Accumulation."
  },
  {
    id: "london",
    label: "Londres Open KZ",
    fullName: "London Open (Judas Swing)",
    emoji: "🏦",
    color: "#22d3ee",
    start: 420,
    end: 600, // 07:00 - 10:00 UTC
    purpose: "Judas Swing : Faux breakout de l'Asian Range & création du Low/High of the Day."
  },
  {
    id: "ny",
    label: "New York Open KZ",
    fullName: "New York AM Session",
    emoji: "🗽",
    color: "#22c55e",
    start: 720,
    end: 900, // 12:00 - 15:00 UTC
    purpose: "Expansion majeure des algorithmes interbancaires ou inversion de Londres."
  },
  {
    id: "london_close",
    label: "Londres Close KZ",
    fullName: "London Close Retracement",
    emoji: "🇬🇧",
    color: "#f59e0b",
    start: 900,
    end: 1020, // 15:00 - 17:00 UTC
    purpose: "Prise de bénéfices institutionnelle et retracement vers l'équilibre."
  }
];

export const LOME_TIMEZONE = "Africa/Lome";

export function getForexMarketStatus(nowDate = new Date()) {
  const day = nowDate.getUTCDay();
  const hour = nowDate.getUTCHours();
  const isOpen = !(day === 6 || (day === 0 && hour < 22) || (day === 5 && hour >= 22));
  let nextOpen: Date | null = null;
  if (!isOpen) {
    nextOpen = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate(), 22, 0, 0));
    if (day === 5) nextOpen.setUTCDate(nextOpen.getUTCDate() + 2);
    else if (day === 6) nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
  }
  return { isOpen, nextOpen };
}

export function getActiveKillZone(date = new Date(), pair?: PairConfig): KillZone | null {
  if (pair && (pair.type === 'crypto' || pair.type === 'synthetic')) {
    // 24/7 markets can still monitor sessions or treat them as informational
  } else {
    if (!getForexMarketStatus(date).isOpen) return null;
  }
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const curMin = hours * 60 + minutes;
  return KILL_ZONES.find(k => curMin >= k.start && curMin < k.end) || null;
}

export function getMinutesUntilNextKZ(date = new Date()): { nextKZ: KillZone; minutesLeft: number } {
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const curMin = hours * 60 + minutes;

  for (const kz of KILL_ZONES) {
    if (curMin < kz.start) {
      return { nextKZ: kz, minutesLeft: kz.start - curMin };
    }
    if (curMin >= kz.start && curMin < kz.end) {
      return { nextKZ: kz, minutesLeft: kz.end - curMin }; // active!
    }
  }
  // Wrap around to next day Asia
  return { nextKZ: KILL_ZONES[0], minutesLeft: (24 * 60 - curMin) + KILL_ZONES[0].start };
}
