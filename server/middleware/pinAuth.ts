import { Request, Response, NextFunction } from 'express';
import { getSetting } from '../db.js';
import { hashPin } from '../lib/hash.js';

export function pinAuth(req: Request, res: Response, next: NextFunction): void {
  const editHash = getSetting.get('edit_pin_hash') as { value: string } | undefined;
  const adminHash = getSetting.get('admin_pin_hash') as { value: string } | undefined;

  if (!editHash && !adminHash) {
    res.status(403).json({ error: 'No PINs configured' });
    return;
  }

  const pin = req.headers['x-pin'] as string | undefined;
  if (!pin) {
    res.status(401).json({ error: 'PIN required' });
    return;
  }

  const hashed = hashPin(pin);
  if (hashed !== editHash?.value && hashed !== adminHash?.value) {
    res.status(401).json({ error: 'Wrong PIN' });
    return;
  }

  next();
}
