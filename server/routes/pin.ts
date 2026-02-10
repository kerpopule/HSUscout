import { Router, Request, Response } from 'express';
import { getSetting, setSetting } from '../db.js';
import { hashPin } from '../lib/hash.js';

const router = Router();

router.get('/pin/status', (_req: Request, res: Response) => {
  const existing = getSetting.get('pin_hash') as { value: string } | undefined;
  res.json({ isSet: !!existing });
});

router.post('/pin/setup', (req: Request, res: Response) => {
  const existing = getSetting.get('pin_hash') as { value: string } | undefined;
  if (existing) {
    res.status(409).json({ error: 'PIN already set' });
    return;
  }

  const { pin } = req.body;
  if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    return;
  }

  setSetting.run({ key: 'pin_hash', value: hashPin(pin) });
  res.json({ ok: true });
});

router.post('/pin/verify', (req: Request, res: Response) => {
  const stored = getSetting.get('pin_hash') as { value: string } | undefined;
  if (!stored) {
    res.json({ valid: false, reason: 'no_pin' });
    return;
  }

  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    res.json({ valid: false });
    return;
  }

  res.json({ valid: hashPin(pin) === stored.value });
});

export default router;
