import { Request, Response } from 'express';
import { fetchLiveCandlesWithMeta } from '../../../../lib/bz/data-engine.server.js';
import { isKnownSymbol, TF_LIST, findPairBySymbol } from '../../../../lib/bz/config.js';

const VALID_INTERVALS = new Set(TF_LIST.map(t => t.apiInterval));

export async function handleCandles(req: Request, res: Response) {
  try {
    const symbol = String(req.query.symbol || 'EUR/USD');
    const interval = String(req.query.interval || '5min');
    const outputsize = Math.max(10, Math.min(500, parseInt(String(req.query.outputsize), 10) || 100));

    const pair = findPairBySymbol(symbol);
    if (!pair) return res.status(400).json({ error: 'Symbole inconnu.' });
    if (!VALID_INTERVALS.has(interval)) return res.status(400).json({ error: 'Intervalle invalide.' });
    if (!isKnownSymbol(symbol)) {
      return res.json({ symbol, interval, candles: [], source: 'Aucune', freshness: 'unavailable', ageSec: null, marketClosed: false, note: `Aucun flux de données pour ${pair.label}.` });
    }

    const result = await fetchLiveCandlesWithMeta(symbol, interval, outputsize);
    res.json({
      symbol, interval,
      candles: result.candles,
      source: result.source,
      quotaRemaining: result.quotaRemaining,
      freshness: result.freshness,
      ageSec: result.ageSec,
      marketClosed: result.marketClosed,
      note: result.note
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
