import { Request, Response, NextFunction } from 'express';
import { getSetting } from '../db.js';
import { hashPin } from '../lib/hash.js';

export function pinAuth(req: Request, res: Response, next: NextFunction): void {
  const storedHash = getSetting.get('pin_hash') as { value: string } | undefined;
  if (!storedHash) {
    res.status(403).json({ error: 'No PIN configured' });
    return;
  }

  const pin = req.headers['x-pin'] as string | undefined;
  if (!pin) {
    res.status(401).json({ error: 'PIN required' });
    return;
  }

  if (hashPin(pin) !== storedHash.value) {
    res.status(401).json({ error: 'Wrong PIN' });
    return;
  }

  next();
}
