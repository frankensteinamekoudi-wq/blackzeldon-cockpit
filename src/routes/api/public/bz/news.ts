import { Request, Response } from 'express';
import { getEconomicNews } from '../../../../lib/bz/news.server.js';

export async function handleNews(req: Request, res: Response) {
  try {
    res.json(await getEconomicNews());
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
