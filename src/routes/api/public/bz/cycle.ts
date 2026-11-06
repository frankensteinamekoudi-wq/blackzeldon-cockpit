import { Request, Response } from 'express';
import { db } from '../../../../lib/bz/db.server.js';

export function handleCycle(req: Request, res: Response) {
  try {
    db.touchCycle();
    res.json({ success: true, timestamp: Date.now() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
