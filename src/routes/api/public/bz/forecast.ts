import { Request, Response } from 'express';
import { generateForecast } from '../../../../lib/bz/forecast.server.js';
import { isKnownSymbol } from '../../../../lib/bz/config.js';

export async function handleForecast(req: Request, res: Response) {
  try {
    const symbol = String(req.query.symbol || 'EUR/USD');
    if (!isKnownSymbol(symbol)) return res.status(400).json({ error: 'Symbole inconnu ou sans flux de données.' });
    res.json(await generateForecast(symbol));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
