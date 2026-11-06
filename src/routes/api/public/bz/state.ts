import { Request, Response } from 'express';
import { getSystemState } from '../../../../lib/bz/cycle.server.js';

export function handleState(req: Request, res: Response) {
  try {
    res.json(getSystemState());
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
