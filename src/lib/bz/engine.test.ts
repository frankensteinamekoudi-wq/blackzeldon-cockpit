process.env.BZ_PERSIST = 'false';
delete process.env.ALLOW_SIMULATOR;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Candle } from '../smc/structure.js';
import { mulberry32, qxHurst, qxReturns, qxMonteCarlo, calcATR } from '../quantum/edge.js';
import { buildTradePlan, computePositionSizing, isPlanSane } from './trade-plan.js';
import { walkForwardRule } from './backtest.js';
import { resolveRecord, journalStats } from './journal-resolver.js';
import type { JournalRecord } from './journal-types.js';
import { resample, sanitizeCandles } from './candle-utils.js';
import { computeFreshness } from './data-engine.server.js';
import { buildNewsResponse, getEconomicNews } from './news.server.js';
import { evaluateSniperOpportunity } from '../smc/sniper-engine.js';
import { detectFVG } from '../smc/fvg.js';
import { computeDynamicRisk } from './scoring.js';
import { checkRateLimit, purgeIdleBuckets } from './access-control.server.js';
import { isDuplicateSignal, registerSignal } from './duplicate.js';
import { findPairBySymbol, isKnownSymbol, PAIRS } from './config.js';
import { generateForecast } from './forecast.server.js';
import { fetchLiveCandlesWithMeta } from './data-engine.server.js';

// ───────── helpers ─────────
function series(n: number, opts: { drift?: number; vol?: number; seed?: number; start?: number; t0?: number; stepMs?: number; phi?: number } = {}): Candle[] {
  const { drift = 0, vol = 0.0005, seed = 42, start = 1.1, t0 = Date.UTC(2026, 10, 2, 0, 0), stepMs = 300_000, phi = 0 } = opts;
  const rnd = mulberry32(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const out: Candle[] = [];
  let px = start, prevRet = 0;
  for (let i = 0; i < n; i++) {
    const ret = drift + phi * prevRet + vol * gauss();
    prevRet = ret;
    const open = px, close = px * (1 + ret);
    const wick = Math.abs(vol * gauss()) * 0.5 * px;
    out.push({ time: new Date(t0 + i * stepMs).toISOString(), open, close, high: Math.max(open, close) + wick, low: Math.min(open, close) - wick, volume: 0 });
    px = close;
  }
  return out;
}

const rec = (o: Partial<JournalRecord>): JournalRecord => ({
  key: 'k', client: 'c', pair: 'EUR/USD', timeframe: '5min', direction: 'BUY', score: 70, probability: 0.55,
  entry: 1.1, sl: 1.099, tp1: 1.101, tp2: 1.102, tp3: 1.103, result: 'pending', rMultiple: 1, exitPrice: null,
  timestamp: Date.UTC(2026, 10, 2, 10, 0), closedAt: null, quality: 'Bon', ...o
});
const cd = (min: number, open: number, high: number, low: number, close: number): Candle => ({
  time: new Date(Date.UTC(2026, 10, 2, 10, min)).toISOString(), open, high, low, close
});

// ───────── quant ─────────
test('Hurst corrigé : bruit blanc proche de 0.5, série persistante nettement au-dessus', () => {
  const hs: number[] = [];
  for (let s = 1; s <= 8; s++) hs.push(qxHurst(qxReturns(series(300, { seed: s }))).h);
  const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
  assert.ok(mean > 0.4 && mean < 0.6, `moyenne bruit blanc = ${mean}`);
  const trending = qxHurst(qxReturns(series(300, { phi: 0.6, seed: 7 }))).h;
  assert.ok(trending > mean + 0.05, `persistante ${trending} vs bruit ${mean}`);
});

test('Monte-Carlo déterministe (même entrée => même sortie)', () => {
  const c = series(120, { seed: 3 });
  const rets = qxReturns(c);
  const atr = calcATR(c, 14);
  const e = c[c.length - 1].close;
  const plan = { entryA: e, sl: e - atr * 2, tp1: e + atr * 2, tp2: e + atr * 4, tp3: e + atr * 6 };
  const a = qxMonteCarlo(c, plan, 'BUY', rets, 300, 40);
  const b = qxMonteCarlo(c, plan, 'BUY', rets, 300, 40);
  assert.deepEqual(a, b);
});

test('Plan de trade : SL structurel borné, cohérent avec le sens', () => {
  const p = buildTradePlan('BUY', 1.1, 0.001, 0.0001, 1.0985);
  assert.ok(p.sl < 1.1 && p.tp1 > 1.1);
  assert.ok(Math.abs(1.1 - p.sl) <= 0.001 * 3.5 + 1e-12 && Math.abs(1.1 - p.sl) >= 0.001 * 1.2 - 1e-12);
  const legacy = buildTradePlan('SELL', 1.1, 0.001, 0.0001);
  assert.ok(Math.abs(legacy.sl - 1.1022) < 1e-9);
  const s = computePositionSizing(1000, 1, 20, 10);
  assert.ok(s.lotSize >= 0.01);
});

test('Risque dynamique prudent et lié à la probabilité empirique', () => {
  assert.equal(computeDynamicRisk(90, 0.45), 0.5);
  assert.equal(computeDynamicRisk(60, 0.52), 1.0);
  assert.equal(computeDynamicRisk(85, 0.62), 2.0);
});

// ───────── backtest ─────────
test('Backtest walk-forward : déterministe, rétréci, bornes cohérentes', () => {
  const c = series(300, { drift: 0.0002, seed: 11 });
  const a = walkForwardRule(c, { pipSize: 0.0001, isCrypto: false });
  const b = walkForwardRule(c, { pipSize: 0.0001, isCrypto: false });
  assert.deepEqual(a, b);
  assert.equal(a.samples, a.wins + a.losses);
  assert.ok(a.shrunk >= 0 && a.shrunk <= 1);
  // le rétrécissement tire vers 50 %
  assert.ok(Math.abs(a.shrunk - 0.5) <= Math.abs(a.rate - 0.5) + 1e-9);
});

test('Backtest : aucune donnée => 50 % et 0 échantillon (pas de probabilité inventée)', () => {
  const r = walkForwardRule(series(30), { pipSize: 0.0001, isCrypto: false });
  assert.equal(r.samples, 0);
  assert.equal(r.shrunk, 0.5);
});

// ───────── journal ─────────
test('Résolution : TP1 gagné, SL perdu, même bougie => perte, gap, expiration', () => {
  const win = resolveRecord(rec({}), [cd(5, 1.1, 1.1012, 1.0995, 1.1008)], Date.UTC(2026, 10, 2, 11));
  assert.equal(win?.result, 'win'); assert.equal(win?.rMultiple, 1);
  const loss = resolveRecord(rec({}), [cd(5, 1.1, 1.1005, 1.0985, 1.099)], Date.UTC(2026, 10, 2, 11));
  assert.equal(loss?.result, 'loss'); assert.equal(loss?.rMultiple, -1);
  const both = resolveRecord(rec({}), [cd(5, 1.1, 1.102, 1.098, 1.1)], Date.UTC(2026, 10, 2, 11));
  assert.equal(both?.result, 'loss');
  const gap = resolveRecord(rec({}), [cd(5, 1.097, 1.098, 1.096, 1.097)], Date.UTC(2026, 10, 2, 11));
  assert.equal(gap?.result, 'loss'); assert.ok((gap?.rMultiple ?? 0) < -1);
  const open = resolveRecord(rec({}), [cd(5, 1.1, 1.1004, 1.0996, 1.1)], Date.UTC(2026, 10, 2, 11));
  assert.equal(open, null);
  const exp = resolveRecord(rec({}), [cd(5, 1.1, 1.1004, 1.0996, 1.1)], Date.UTC(2026, 10, 4, 11));
  assert.equal(exp?.result, 'expired');
});

test('Résolution : ignore les bougies antérieures au trade et les trades déjà clos', () => {
  const before: Candle = { time: new Date(Date.UTC(2026, 10, 2, 9, 55)).toISOString(), open: 1.1, high: 1.2, low: 1.0, close: 1.1 };
  assert.equal(resolveRecord(rec({}), [before], Date.UTC(2026, 10, 2, 11)), null);
  assert.equal(resolveRecord(rec({ result: 'win' }), [cd(5, 1.1, 1.2, 1.0, 1.1)]), null);
  const sell = resolveRecord(rec({ direction: 'SELL', sl: 1.101, tp1: 1.099 }), [cd(5, 1.1, 1.1004, 1.0985, 1.099)], Date.UTC(2026, 10, 2, 11));
  assert.equal(sell?.result, 'win');
});

test('Statistiques du journal : calculées sur les trades clos uniquement', () => {
  const s = journalStats([rec({ result: 'win', rMultiple: 1 }), rec({ key: 'b', result: 'loss', rMultiple: -1 }), rec({ key: 'c', result: 'pending' }), rec({ key: 'd', result: 'win', rMultiple: 2 })]);
  assert.equal(s.closed, 3); assert.equal(s.wins, 2);
  assert.ok(Math.abs((s.winRate ?? 0) - 2 / 3) < 1e-9);
  assert.equal(s.totalR, 2);
});

// ───────── données ─────────
test('Rééchantillonnage 1h -> 4h : OHLC correct et aligné UTC', () => {
  const h1 = series(8, { stepMs: 3_600_000, t0: Date.UTC(2026, 10, 2, 0, 0) });
  const h4 = resample(h1, 4 * 3600);
  assert.equal(h4.length, 2);
  assert.equal(h4[0].open, h1[0].open);
  assert.equal(h4[0].close, h1[3].close);
  assert.equal(h4[0].high, Math.max(...h1.slice(0, 4).map(c => c.high)));
  assert.equal(h4[1].low, Math.min(...h1.slice(4, 8).map(c => c.low)));
  assert.equal(new Date(h4[1].time as string).getUTCHours(), 4);
});

test('sanitizeCandles : tri, doublons, enveloppe réparée, NaN retirés', () => {
  const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
  const out = sanitizeCandles([
    { time: t(5), open: 1, high: 0.9, low: 1.2, close: 1.1 },
    { time: t(0), open: 1, high: 1.1, low: 0.9, close: 1 },
    { time: t(0), open: 2, high: 2, low: 2, close: 2 },
    { time: t(10), open: NaN, high: 1, low: 1, close: 1 }
  ]);
  assert.equal(out.length, 2);
  assert.ok(out[1].high >= out[1].low);
  assert.ok((out[0].time as string) < (out[1].time as string));
});

test('Fraîcheur mesurée sur l’âge réel de la dernière bougie', () => {
  const now = Date.UTC(2026, 10, 2, 12, 0);
  const fresh = [{ time: new Date(now - 60_000).toISOString(), open: 1, high: 1, low: 1, close: 1 }];
  const old = [{ time: new Date(now - 3 * 3600_000).toISOString(), open: 1, high: 1, low: 1, close: 1 }];
  assert.equal(computeFreshness(fresh, '5min', now).freshness, 'live');
  assert.equal(computeFreshness(old, '5min', now).freshness, 'stale');
  assert.equal(computeFreshness([], '5min', now).freshness, 'unavailable');
});

test('Config : les indices synthétiques n’ont pas de flux, les autres oui', () => {
  assert.ok(PAIRS.filter(p => p.type === 'synthetic').every(p => !p.feed));
  assert.ok(PAIRS.filter(p => p.type !== 'synthetic').every(p => p.feed));
  assert.equal(isKnownSymbol('R_75'), false);
  assert.equal(isKnownSymbol('EUR/USD'), true);
  assert.equal(findPairBySymbol('DIA')?.id, 'US30');
});

test('Sans source de données : AUCUNE bougie aléatoire (unavailable)', async () => {
  const r = await fetchLiveCandlesWithMeta('R_75', '5min', 100);
  assert.equal(r.freshness, 'unavailable');
  assert.equal(r.candles.length, 0);
  const syn = await fetchLiveCandlesWithMeta('BOOM500', '5min', 100);
  assert.equal(syn.freshness, 'unavailable');
});

test('Forecast : jamais de chiffres inventés quand les données manquent', async () => {
  const fc = await generateForecast('R_75');
  assert.ok(fc.rows.length === 4);
  for (const row of fc.rows) {
    assert.equal(row.status, 'INSUFFICIENT');
    assert.equal(row.probability, 0);
    assert.equal(row.calibrated, false);
    assert.equal(row.similarSamples, 0);
  }
});

// ───────── news ─────────
test('News : pas de faux NFP — sans clé, tout est vide et la source est « unavailable »', async () => {
  delete process.env.FINNHUB_API_KEY;
  const n = await getEconomicNews();
  assert.equal(n.source, 'unavailable');
  assert.equal(n.upcoming.length, 0);
  assert.equal(n.exposure.length, 0);
  assert.equal(n.stats.length, 0);
});

test('News : fenêtres PRE / POST calculées à partir des vrais horaires', () => {
  const now = Date.UTC(2026, 10, 6, 13, 0);
  const ev = (min: number, impact: 'high' | 'low', ccy = 'USD') => ({ event: 'X', currency: ccy, time: new Date(now + min * 60000).toISOString(), impact });
  const r = buildNewsResponse([ev(20, 'high'), ev(-5, 'high', 'EUR'), ev(10, 'low'), ev(120, 'high')], now);
  assert.equal(r.exposure.length, 2);
  assert.ok(r.exposure.some(e => e.phase === 'PRE' && e.currency === 'USD'));
  assert.ok(r.exposure.some(e => e.phase === 'POST' && e.currency === 'EUR'));
  assert.ok(r.upcoming.every(e => e.impact !== 'low'));
});

// ───────── FVG ─────────
test('FVG haussier non retesté reste actif (avant : supprimé dès que le prix s’en éloignait)', () => {
  const t = (i: number) => new Date(Date.UTC(2026, 10, 2, 0, i * 5)).toISOString();
  const c: Candle[] = [
    { time: t(0), open: 1.0990, high: 1.1000, low: 1.0980, close: 1.0995 },
    { time: t(1), open: 1.0995, high: 1.1030, low: 1.0994, close: 1.1028 },
    { time: t(2), open: 1.1028, high: 1.1040, low: 1.1010, close: 1.1038 }, // gap 1.1000 -> 1.1010
    { time: t(3), open: 1.1038, high: 1.1060, low: 1.1035, close: 1.1055 },
    { time: t(4), open: 1.1055, high: 1.1080, low: 1.1050, close: 1.1075 },
    { time: t(5), open: 1.1075, high: 1.1090, low: 1.1070, close: 1.1085 }
  ];
  const f = detectFVG(c, 0.0001, false);
  assert.ok(f.some(x => x.type === 'bull' && !x.mitigated && x.fill === 0));
});

// ───────── Sniper ─────────
test('Sniper : pas de points offerts, direction WAIT sans biais, score brut', () => {
  const c = series(120, { seed: 5, t0: Date.UTC(2026, 10, 2, 12, 0) });
  const s = evaluateSniperOpportunity(c, 'EUR/USD', 0.0001, 5);
  assert.equal(s.direction, 'WAIT');
  assert.ok(s.score < 65);
  const scored = s.confluences.filter(x => x.weight > 0);
  assert.equal(scored.reduce((a, x) => a + x.weight, 0), 100);
  assert.ok(s.confluences.find(x => x.id === 'risk_cap')!.weight === 0);
});

test('Sniper : Silver Bullet basé sur l’heure de la bougie et le fuseau New York (DST)', () => {
  // 3 nov 2026 15:30 UTC = 10:30 New York (EST) => actif ; 15 juil 2026 15:30 UTC = 11:30 EDT => inactif
  const winter = series(60, { seed: 1, t0: Date.UTC(2026, 10, 3, 15, 30) - 59 * 300_000 });
  const summer = series(60, { seed: 1, t0: Date.UTC(2026, 6, 15, 15, 30) - 59 * 300_000 });
  assert.equal(evaluateSniperOpportunity(winter, 'EUR/USD', 0.0001, 5).silverBullet.isActive, true);
  assert.equal(evaluateSniperOpportunity(summer, 'EUR/USD', 0.0001, 5).silverBullet.isActive, false);
});

test('Sniper : SMT non évalué sans paire corrélée, évalué avec', () => {
  const c = series(80, { seed: 9, t0: Date.UTC(2026, 10, 3, 9, 0) });
  const none = evaluateSniperOpportunity(c, 'EUR/USD', 0.0001, 5);
  assert.equal(none.smtDivergence.detected, false);
  assert.match(none.smtDivergence.description, /Non évalué/);
  const closes = c.slice(-25).map(x => x.close);
  const withCorr = evaluateSniperOpportunity(c, 'EUR/USD', 0.0001, 5, 10, 1, { correlated: { label: 'GBP/USD', closes } });
  assert.doesNotMatch(withCorr.smtDivergence.description, /Non évalué/);
});

test('Sniper : valeur de pip de l’or corrigée (0,10 $ / pip / 0,01 lot) et SL jamais sous le spread', () => {
  const c = series(80, { seed: 2, start: 2650, vol: 0.0004, t0: Date.UTC(2026, 10, 3, 9, 0) });
  const s = evaluateSniperOpportunity(c, 'XAU/USD', 0.1, 2);
  assert.ok(Math.abs(s.capitalRiskDollars - s.riskPips * 0.1) < 0.02);
  assert.ok(s.riskPips >= 2.5 * 3);
});

test('Sniper : SL structurel trop large => DANGER_SKIP (pas de compression artificielle)', () => {
  const c = series(80, { seed: 4, vol: 0.004, t0: Date.UTC(2026, 10, 3, 9, 0) });
  const s = evaluateSniperOpportunity(c, 'EUR/USD', 0.0001, 5, 10, 1.0);
  assert.equal(s.accountSafetyStatus, 'DANGER_SKIP');
  assert.equal(s.isSniperReady, false);
});

// ───────── sécurité ─────────
test('Limiteur de débit : rafale bornée puis refus, purge des entrées inactives', () => {
  const now = 1_000_000;
  let allowed = 0;
  for (let i = 0; i < 200; i++) if (checkRateLimit('ip-test', now).allowed) allowed++;
  assert.ok(allowed <= 120 && allowed >= 100);
  assert.equal(checkRateLimit('ip-test', now + 60_000).allowed, true);
  assert.ok(purgeIdleBuckets(1000, now + 3_600_000) >= 1);
});

test('Anti-doublon : proximité mesurée en pips', () => {
  registerSignal('EUR/USD', '5min', 'BUY', 1.1000, 1.0990);
  assert.equal(isDuplicateSignal('EUR/USD', '5min', 'BUY', 1.1002, 1.0990, 0.0001, 5), true);
  assert.equal(isDuplicateSignal('EUR/USD', '5min', 'BUY', 1.1020, 1.0990, 0.0001, 5), false);
});

test('Garde-fou SL/TP : toujours du bon côté de l’entrée, dans le bon ordre', () => {
  for (const dir of ['BUY', 'SELL'] as const) {
    for (const [entry, atr, pip] of [[1.1, 0.001, 0.0001], [4090, 6, 0.1], [60000, 150, 1]] as const) {
      const p = buildTradePlan(dir, entry, atr, pip);
      assert.ok(isPlanSane(dir, { entry: p.entryA, sl: p.sl, tp1: p.tp1, tp2: p.tp2, tp3: p.tp3 }), `${dir} ${entry}`);
    }
  }
  assert.equal(isPlanSane('BUY', { entry: 1.1, sl: 1.101, tp1: 1.102, tp2: 1.103, tp3: 1.104 }), false); // SL et TP du même côté
  assert.equal(isPlanSane('SELL', { entry: 1.1, sl: 1.099, tp1: 1.098, tp2: 1.097, tp3: 1.096 }), false);
});
