/**
 * SMC Structure Engine - Ruptures de structure (BOS), Changement de caractère (CHoCH),
 * Swings Highs / Lows et Équilibre Premium / Discount.
 */

export interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SwingPoint {
  idx: number;
  price: number;
  time?: string | number;
}

export function findSwings(candles: Candle[], lookback = 2): { swingHighs: SwingPoint[]; swingLows: SwingPoint[] } {
  const swingHighs: SwingPoint[] = [];
  const swingLows: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= lookback; k++) {
      if (candles[i - k].high >= c.high || candles[i + k].high >= c.high) isHigh = false;
      if (candles[i - k].low <= c.low || candles[i + k].low <= c.low) isLow = false;
    }
    if (isHigh) swingHighs.push({ idx: i, price: c.high, time: c.time });
    if (isLow) swingLows.push({ idx: i, price: c.low, time: c.time });
  }
  return { swingHighs, swingLows };
}

export interface SMCStructureResult {
  structure: 'Haussier' | 'Baissier';
  bos: 'haussier' | 'baissier' | null;
  bosStrength: number;
  choch: 'haussier' | 'baissier' | null;
  chochStrength: number;
  rHigh: number;
  rLow: number;
  range: number;
  equilibrium: number;
  zone: 'Premium' | 'Discount';
  zonePos: number; // 0 to 1
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
}

export function analyzeStructure(candles: Candle[], pipSize = 0.0001, isCrypto = false): SMCStructureResult | null {
  if (!candles || candles.length < 15) return null;
  const n = candles.length;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = candles[n - 1];

  const rHigh = Math.max(...highs.slice(-30));
  const rLow = Math.min(...lows.slice(-30));
  const range = rHigh - rLow || pipSize;
  const equilibrium = (rHigh + rLow) / 2;
  const zonePos = (last.close - rLow) / range;
  const zone = zonePos > 0.5 ? 'Premium' : 'Discount';

  const { swingHighs, swingLows } = findSwings(candles, 2);

  // Fallback heuristique si peu de swings identifiés
  const halfLen = Math.floor(Math.min(n, 20) / 2);
  const olderAvg = closes.slice(Math.max(0, n - halfLen * 2), Math.max(0, n - halfLen)).reduce((a, b) => a + b, 0) / halfLen;
  const newerAvg = closes.slice(Math.max(0, n - halfLen), n).reduce((a, b) => a + b, 0) / halfLen;
  let structure: 'Haussier' | 'Baissier' = newerAvg >= olderAvg ? 'Haussier' : 'Baissier';

  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const hh = swingHighs[swingHighs.length - 1].price > swingHighs[swingHighs.length - 2].price;
    const hl = swingLows[swingLows.length - 1].price > swingLows[swingLows.length - 2].price;
    const lh = swingHighs[swingHighs.length - 1].price < swingHighs[swingHighs.length - 2].price;
    const ll = swingLows[swingLows.length - 1].price < swingLows[swingLows.length - 2].price;
    if (hh && hl) structure = 'Haussier';
    else if (lh && ll) structure = 'Baissier';
  }

  const rangeMultiplier = isCrypto ? 0.04 : 0.015;
  const minStrength = isCrypto ? 0.025 : 0.012;

  // BOS
  const pH = Math.max(...highs.slice(Math.max(0, n - 30), -3));
  const pL = Math.min(...lows.slice(Math.max(0, n - 30), -3));
  let bos: 'haussier' | 'baissier' | null = null;
  let bosStrength = 0;

  if (last.close > pH + range * rangeMultiplier) {
    bos = 'haussier';
    bosStrength = (last.close - pH) / range;
  } else if (last.close < pL - range * rangeMultiplier) {
    bos = 'baissier';
    bosStrength = (pL - last.close) / range;
  }
  if (bos && bosStrength < minStrength) bos = null;

  // CHoCH
  let choch: 'haussier' | 'baissier' | null = null;
  let chochStrength = 0;

  if (structure === 'Haussier' && swingLows.length >= 1) {
    const lastSwingLow = swingLows[swingLows.length - 1];
    for (let i = lastSwingLow.idx + 1; i < n; i++) {
      if (candles[i].close < lastSwingLow.price - range * rangeMultiplier) {
        choch = 'baissier';
        chochStrength = (lastSwingLow.price - candles[i].close) / range;
        break;
      }
    }
  } else if (structure === 'Baissier' && swingHighs.length >= 1) {
    const lastSwingHigh = swingHighs[swingHighs.length - 1];
    for (let i = lastSwingHigh.idx + 1; i < n; i++) {
      if (candles[i].close > lastSwingHigh.price + range * rangeMultiplier) {
        choch = 'haussier';
        chochStrength = (candles[i].close - lastSwingHigh.price) / range;
        break;
      }
    }
  }
  if (choch && chochStrength < minStrength) choch = null;

  return {
    structure,
    bos,
    bosStrength,
    choch,
    chochStrength,
    rHigh,
    rLow,
    range,
    equilibrium,
    zone,
    zonePos,
    swingHighs,
    swingLows
  };
}
