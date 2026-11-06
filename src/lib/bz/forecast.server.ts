import { ForecastResponse, ForecastRow } from './forecast.js';
import { fetchLiveCandlesWithMeta } from './data-engine.server.js';
import { analyzeStructure } from '../smc/structure.js';
import { calcATR } from '../quantum/edge.js';
import { findPairBySymbol } from './config.js';
import { biasFromStructure, planFor, walkForwardRule } from './backtest.js';

const TFS: Array<{ tf: ForecastRow['tf']; interval: string; horizon: number; horizonMinutes: number }> = [
  { tf: '5min', interval: '5min', horizon: 12, horizonMinutes: 60 },
  { tf: '15min', interval: '15min', horizon: 16, horizonMinutes: 240 },
  { tf: '1h', interval: '1h', horizon: 10, horizonMinutes: 600 },
  { tf: '4h', interval: '4h', horizon: 8, horizonMinutes: 1920 }
];

const MIN_SAMPLES_READY = 12;
const MIN_SAMPLES_CALIBRATED = 30;

export async function generateForecast(symbol: string): Promise<ForecastResponse> {
  const pair = findPairBySymbol(symbol);
  const rows: ForecastRow[] = [];
  let source = 'Aucune';
  let worst = 'live';

  for (const item of TFS) {
    const res = await fetchLiveCandlesWithMeta(symbol, item.interval, 300);
    source = res.source !== 'Aucune' ? res.source : source;
    if (res.freshness !== 'live') worst = res.freshness;
    const candles = res.candles;
    const usable = !!pair && pair.feed && res.freshness === 'live' && candles.length >= 60;

    const base: ForecastRow = {
      tf: item.tf, direction: 'NEUTRAL', probability: 0, amplitudeAtr: 0,
      horizon: item.horizon, horizonMinutes: item.horizonMinutes, target: 0, invalidation: 0,
      factors: [], similarSamples: 0, successRate: 0, resolved: 0, calibrated: false,
      dataAgeSec: res.ageSec, status: 'INSUFFICIENT'
    };

    if (!usable || !pair) {
      rows.push({ ...base, factors: [res.note || `Données ${res.freshness} : pas de prévision.`] });
      continue;
    }

    const smc = analyzeStructure(candles, pair.pip, pair.type === 'crypto');
    if (!smc) { rows.push({ ...base, factors: ['Structure non exploitable.'] }); continue; }

    const dir = biasFromStructure(smc);
    const plan = planFor(candles, dir, pair.pip, pair.type === 'crypto');
    const atr = calcATR(candles, 14);
    const stats = walkForwardRule(candles, { dir, pipSize: pair.pip, isCrypto: pair.type === 'crypto', horizon: item.horizon, step: 2 });

    rows.push({
      ...base,
      direction: dir,
      probability: Math.round(stats.shrunk * 100),
      amplitudeAtr: parseFloat((Math.abs(plan.tp1 - plan.entryA) / (atr || 1e-9)).toFixed(1)),
      target: parseFloat(plan.tp1.toFixed(pair.digits)),
      invalidation: parseFloat(plan.sl.toFixed(pair.digits)),
      factors: [
        smc.bos ? `BOS ${smc.bos}` : smc.choch ? `CHoCH ${smc.choch}` : 'Structure de tendance',
        smc.zone === 'Discount' ? 'Zone Discount' : 'Zone Premium',
        `Backtest local : ${stats.wins} gagnés / ${stats.losses} perdus (${stats.timeouts} sans issue)`
      ],
      similarSamples: stats.samples,
      successRate: Math.round(stats.rate * 100),
      resolved: stats.samples,
      calibrated: stats.samples >= MIN_SAMPLES_CALIBRATED,
      status: stats.samples >= MIN_SAMPLES_READY ? 'READY' : 'INSUFFICIENT'
    });
  }

  return {
    symbol, timestamp: Date.now(), rows, source, freshness: worst,
    note: 'Probabilités empiriques issues d’un backtest walk-forward local (SL structurel, TP1=1R, hors coûts). Estimation, pas une garantie.'
  };
}
