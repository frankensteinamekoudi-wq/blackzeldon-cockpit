import { Request, Response } from 'express';
import { getEconomicNews, currenciesOf } from '../../../../lib/bz/news.server.js';

export async function handleNewsPoll(req: Request, res: Response) {
  try {
    const symbol = String(req.query.symbol || 'EUR/USD');
    const news = await getEconomicNews();
    const ccys = currenciesOf(symbol);
    res.json({ symbol, exposure: news.exposure.some(e => ccys.includes(e.currency)), news });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
