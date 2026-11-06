import { Request, Response } from 'express';
import { db, JournalRecord } from '../../../../lib/bz/db.server.js';

const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: any, max = 64): string => (typeof v === 'string' ? v.slice(0, max) : '');

function sanitizeEntry(e: any): Partial<JournalRecord> | null {
  if (!e || typeof e !== 'object' || typeof e.key !== 'string' || !e.key || e.key.length > 80) return null;
  const direction = e.direction === 'BUY' || e.direction === 'SELL' ? e.direction : null;
  const result = ['win', 'loss', 'expired', 'pending'].includes(e.result) ? e.result : 'pending';
  return {
    key: e.key,
    pair: str(e.pair, 32),
    timeframe: str(e.timeframe, 16),
    direction,
    score: num(e.score),
    probability: num(e.probability),
    entry: num(e.entry), sl: num(e.sl), tp1: num(e.tp1), tp2: num(e.tp2), tp3: num(e.tp3),
    result,
    rMultiple: num(e.rMultiple),
    exitPrice: num(e.exitPrice),
    timestamp: num(e.timestamp) ?? Date.now(),
    closedAt: num(e.closedAt),
    quality: e.quality ? str(e.quality, 24) : null
  };
}

export function handleGetJournal(req: Request, res: Response) {
  try {
    const client = typeof req.query.client === 'string' ? req.query.client.slice(0, 64) : undefined;
    const days = Math.min(3650, parseInt(String(req.query.days), 10) || 3650);
    res.json({ entries: db.getJournalEntries(client, days) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}

export function handlePostJournal(req: Request, res: Response) {
  try {
    const { client, entries } = req.body || {};
    if (!Array.isArray(entries) || entries.length > 100) return res.status(400).json({ error: 'entries invalide (max 100).' });
    const clean = entries.map(sanitizeEntry).filter(Boolean) as Partial<JournalRecord>[];
    db.saveJournalEntries(str(client, 64) || 'anonymous', clean);
    res.json({ success: true, count: clean.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
