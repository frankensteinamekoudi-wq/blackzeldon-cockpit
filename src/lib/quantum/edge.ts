import { Candle } from '../smc/structure.js';

export function qxReturns(candles: Candle[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const a = candles[i - 1].close;
    const b = candles[i].close;
    if (a > 0 && b > 0) r.push(Math.log(b / a));
  }
  return r;
}

export function qxMean(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

export function qxStd(a: number[]): number {
  if (a.length < 2) return 0;
  const m = qxMean(a);
  return Math.sqrt(a.reduce((x, y) => x + Math.pow(y - m, 2), 0) / (a.length - 1));
}

export function calcATR(candles: Candle[], period = 14): number {
  if (!candles || candles.length < 2) return 0.001;
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const p = Math.min(period, tr.length);
  let atr = tr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let j = p; j < tr.length; j++) {
    atr = (atr * (period - 1) + tr[j]) / period;
  }
  return atr;
}

// Hurst Exponent — R/S corrigé (Anis-Lloyd / Peters).
// Le R/S brut est biaisé vers le haut sur de courts échantillons (une marche aléatoire sort ~0.55-0.6).
// On soustrait l'espérance théorique du R/S d'un bruit blanc avant la régression log-log.
function expectedRS(n: number): number {
  let sum = 0;
  for (let i = 1; i < n; i++) sum += Math.sqrt((n - i) / i);
  return ((n - 0.5) / n) * Math.pow((n * Math.PI) / 2, -0.5) * sum;
}

export function qxHurst(returns: number[]): { h: number; regime: string } {
  const n = returns.length;
  if (n < 48) return { h: 0.5, regime: "Indéterminé" };
  // au moins 2 blocs par taille pour limiter le bruit
  const sizes = [8, 16, 32, 64, 128].filter(s => s <= n / 2);
  const xs: number[] = [], ys: number[] = [];

  sizes.forEach(size => {
    const blocks = Math.floor(n / size);
    let acc = 0, cnt = 0;
    for (let b = 0; b < blocks; b++) {
      const seg = returns.slice(b * size, (b + 1) * size);
      const m = qxMean(seg);
      let cum = 0, mn = Infinity, mx = -Infinity;
      seg.forEach(v => {
        cum += v - m;
        if (cum < mn) mn = cum;
        if (cum > mx) mx = cum;
      });
      const sd = Math.sqrt(seg.reduce((x, y) => x + Math.pow(y - m, 2), 0) / seg.length); // écart-type population
      if (sd > 0) {
        acc += (mx - mn) / sd;
        cnt++;
      }
    }
    if (cnt) {
      const rs = acc / cnt;
      // Peters : log( R/S - E[R/S] + sqrt(n*pi/2) )
      const corrected = rs - expectedRS(size) + Math.sqrt((size * Math.PI) / 2);
      if (corrected > 0) {
        xs.push(Math.log(size));
        ys.push(Math.log(corrected));
      }
    }
  });

  if (xs.length < 2) return { h: 0.5, regime: "Indéterminé" };
  const mx = qxMean(xs), my = qxMean(ys);
  let num = 0, den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += Math.pow(x - mx, 2);
  });
  const h = den ? num / den : 0.5;
  const clamped = Math.max(0, Math.min(1, h));
  return {
    h: clamped,
    regime: clamped > 0.58 ? "Persistant (tendance)" : clamped < 0.42 ? "Anti-persistant (range)" : "Neutre (proche du hasard)"
  };
}

// Shannon Entropy
export function qxEntropy(returns: number[], bins = 12): number {
  if (returns.length < 20) return 1;
  const mn = Math.min(...returns), mx = Math.max(...returns);
  if (mx === mn) return 0;
  const hist = new Array(bins).fill(0);
  returns.forEach(v => {
    const i = Math.min(bins - 1, Math.floor(((v - mn) / (mx - mn)) * bins));
    hist[i]++;
  });
  let H = 0;
  hist.forEach(c => {
    if (c) {
      const p = c / returns.length;
      H -= p * Math.log(p);
    }
  });
  return H / Math.log(bins);
}

// Autocorrelation lag-1
export function qxAutocorr(returns: number[], lag = 1): number {
  const n = returns.length;
  if (n < lag + 8) return 0;
  const m = qxMean(returns);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    den += Math.pow(returns[i] - m, 2);
    if (i >= lag) num += (returns[i] - m) * (returns[i - lag] - m);
  }
  return den ? num / den : 0;
}

// Katz Fractal Dimension
export function qxFractalDim(closes: number[]): number {
  const n = closes.length;
  if (n < 12) return 1.5;
  let L = 0, d = 0;
  for (let i = 1; i < n; i++) {
    L += Math.abs(closes[i] - closes[i - 1]);
    d = Math.max(d, Math.abs(closes[i] - closes[0]));
  }
  if (!L || !d) return 1.5;
  const a = L / (n - 1);
  return Math.log10(L / a) / (Math.log10(d / a) + Math.log10(L / a) || 1);
}

// Volatility Squeeze (short vs long ATR)
export function qxSqueeze(candles: Candle[]): { ratio: number; state: string } {
  if (candles.length < 60) return { ratio: 1, state: "N/A" };
  const shortA = calcATR(candles.slice(-15), 10);
  const longA = calcATR(candles.slice(-60), 30);
  const ratio = longA > 0 ? shortA / longA : 1;
  return {
    ratio,
    state: ratio < 0.62 ? "Compression extrême" : ratio < 0.85 ? "Compression" : ratio > 1.35 ? "Expansion" : "Normale"
  };
}

// Tail Risk (VaR95 & CVaR95)
export function qxTailRisk(returns: number[]): { var95: number; cvar95: number } {
  if (returns.length < 25) return { var95: 0, cvar95: 0 };
  const s = returns.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.floor(s.length * 0.05) - 1);
  const var95 = s[idx];
  const tail = s.slice(0, idx + 1);
  return { var95: Math.abs(var95), cvar95: Math.abs(qxMean(tail)) };
}

// Z-Score
export function qxZScore(returns: number[]): number {
  if (returns.length < 20) return 0;
  const hist = returns.slice(0, -1);
  const last = returns[returns.length - 1];
  const sd = qxStd(hist);
  if (!sd) return 0;
  return (last - qxMean(hist)) / sd;
}

// Order Flow Absorption
export function qxAbsorption(candles: Candle[]): { ratio: number; note: string } {
  const c = candles.slice(-8);
  if (c.length < 5) return { ratio: 0, note: "—" };
  let range = 0;
  c.forEach(x => { range += (x.high - x.low); });
  const net = Math.abs(c[c.length - 1].close - c[0].open);
  const ratio = range > 0 ? net / range : 0;
  return {
    ratio,
    note: ratio < 0.18 ? "Absorption forte (accumulation)" : ratio > 0.55 ? "Expansion directionnelle" : "Flux équilibré"
  };
}

// GARCH(1,1) Volatility Forecast
export function qxGarch(rets: number[]): { sigma: number; ratio: number; state: string } {
  if (!rets || rets.length < 40) return { sigma: 0, ratio: 1, state: "N/A" };
  const a = 0.09, b = 0.88;
  const lt = rets.reduce((k, r) => k + r * r, 0) / rets.length;
  const omega = Math.max(1e-12, lt * (1 - a - b));
  let v = lt;
  for (let i = 0; i < rets.length; i++) v = omega + a * rets[i] * rets[i] + b * v;
  const sigma = Math.sqrt(Math.max(v, 1e-12));
  const ratio = Math.sqrt(lt) > 0 ? sigma / Math.sqrt(lt) : 1;
  return {
    sigma,
    ratio,
    state: ratio > 1.35 ? "Vol. en expansion" : ratio < 0.75 ? "Vol. comprimée" : "Vol. stable"
  };
}

// Markov Chain Persistence
export function qxMarkov(rets: number[]): { persist: number; note: string; last: number } {
  if (!rets || rets.length < 30) return { persist: 0.5, note: "N/A", last: 0 };
  let uu = 0, ud = 0, du = 0, dd = 0;
  for (let i = 1; i < rets.length; i++) {
    const prev = rets[i - 1] >= 0, cur = rets[i] >= 0;
    if (prev && cur) uu++;
    else if (prev && !cur) ud++;
    else if (!prev && cur) du++;
    else dd++;
  }
  const last = rets[rets.length - 1] >= 0 ? 1 : -1;
  const pUp = (uu + 1) / (uu + ud + 2);
  const pDn = (dd + 1) / (dd + du + 2);
  const persist = last > 0 ? pUp : pDn;
  return {
    persist,
    last,
    note: persist > 0.58 ? "Continuation probable" : persist < 0.44 ? "Retournement probable" : "Neutre"
  };
}

// Kalman Filter Trend Slope & Confidence
export function qxKalman(closes: number[]): { slope: number; conf: number; dir: string } {
  if (!closes || closes.length < 25) return { slope: 0, conf: 0, dir: "Neutre" };
  let x = closes[0], v = 0, P = [[1, 0], [0, 1]];
  const q = 1e-5, r = 1e-2;
  for (let i = 1; i < closes.length; i++) {
    x = x + v;
    P = [
      [P[0][0] + P[0][1] + P[1][0] + P[1][1] + q, P[0][1] + P[1][1]],
      [P[1][0] + P[1][1], P[1][1] + q]
    ];
    const S = P[0][0] + r, K0 = P[0][0] / S, K1 = P[1][0] / S;
    const y = closes[i] - x;
    x += K0 * y;
    v += K1 * y;
    P = [
      [P[0][0] * (1 - K0), P[0][1] * (1 - K0)],
      [P[1][0] - K1 * P[0][0], P[1][1] - K1 * P[0][1]]
    ];
  }
  const ref = closes[closes.length - 1] || 1;
  const slope = ref ? v / ref : 0;
  const rr: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1]) rr.push(closes[i] / closes[i - 1] - 1);
  const sd = qxStd(rr) || 1e-9;
  const conf = Math.max(0, Math.min(1, Math.abs(slope) / (sd * 1.5)));
  return { slope, conf, dir: slope > 0 ? "Haussier" : slope < 0 ? "Baissier" : "Neutre" };
}

// Hawkes Shock Intensity
export function qxHawkes(rets: number[]): { lambda: number; state: string } {
  if (!rets || rets.length < 40) return { lambda: 0, state: "N/A" };
  const sd = qxStd(rets) || 1e-9, decay = 0.86;
  let lam = 0;
  for (let i = 0; i < rets.length; i++) {
    lam *= decay;
    if (Math.abs(rets[i]) > 2 * sd) lam += 1;
  }
  const norm = Math.max(0, Math.min(1, lam / 4));
  return {
    lambda: norm,
    state: norm > 0.6 ? "Chocs en grappe (danger)" : norm > 0.3 ? "Activité soutenue" : "Marché calme"
  };
}

// PRNG déterministe (mulberry32) : mêmes données => même résultat (plus de scintillement à chaque rafraîchissement).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Monte-Carlo Bootstrap Simulation
// - rendements recentrés (on retire la dérive de l'échantillon, qui sinon biaise la probabilité) ;
// - graine déterministe issue des données ;
// - touches SL/TP évaluées sur les clôtures simulées (approximation : pas de mèches intrabougie).
export function qxMonteCarlo(
  candles: Candle[],
  plan: { entryA: number; sl: number; tp1: number; tp2: number; tp3: number } | null,
  dir: 'BUY' | 'SELL' | string,
  rets: number[],
  paths = 500,
  horizon = 60
) {
  if (!plan || !rets || rets.length < 30 || (dir !== "BUY" && dir !== "SELL")) return null;
  const N = paths, Hn = horizon;
  const mu = qxMean(rets);
  rets = rets.map(r => r - mu);
  const seed = Math.floor(Math.abs(candles[candles.length - 1].close) * 1e6) ^ (candles.length * 2654435761);
  const rand = mulberry32(seed);
  const price0 = candles[candles.length - 1].close;
  const isBuy = dir === "BUY";
  const { sl, tp1, tp2, tp3, entryA } = plan;
  if (![sl, tp1, tp2, tp3, entryA].every(Number.isFinite)) return null;
  const risk = Math.abs(entryA - sl) || 1e-9;
  let hit1 = 0, hit2 = 0, hit3 = 0, stops = 0, sumR = 0, timeouts = 0;
  const L = rets.length;

  for (let n = 0; n < N; n++) {
    let px = price0, done = false;
    for (let t = 0; t < Hn; t++) {
      px = px * (1 + rets[(rand() * L) | 0]);
      if ((isBuy && px <= sl) || (!isBuy && px >= sl)) {
        stops++;
        sumR -= 1;
        done = true;
        break;
      }
      if ((isBuy && px >= tp3) || (!isBuy && px <= tp3)) {
        hit1++; hit2++; hit3++;
        sumR += 3;
        done = true;
        break;
      }
      if ((isBuy && px >= tp2) || (!isBuy && px <= tp2)) {
        hit1++; hit2++;
        sumR += 2;
        done = true;
        break;
      }
      if ((isBuy && px >= tp1) || (!isBuy && px <= tp1)) {
        hit1++;
        sumR += 1;
        done = true;
        break;
      }
    }
    if (!done) {
      timeouts++;
      sumR += (isBuy ? (px - entryA) : (entryA - px)) / risk;
    }
  }

  return {
    pTP1: hit1 / N,
    pTP2: hit2 / N,
    pTP3: hit3 / N,
    pSL: stops / N,
    pTimeout: timeouts / N,
    expR: sumR / N,
    paths: N,
    horizon: Hn
  };
}
