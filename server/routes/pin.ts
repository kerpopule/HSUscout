import { Router, Request, Response } from 'express';
import { getSetting } from '../db.js';
import { hashPin } from '../lib/hash.js';

const router = Router();

router.get('/pin/status', (_req: Request, res: Response) => {
  res.json({ isSet: true });
});

router.post('/pin/verify', (req: Request, res: Response) => {
  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    res.json({ valid: false });
    return;
  }
  const hashed = hashPin(pin);
  const editHash = getSetting.get('edit_pin_hash') as { value: string } | undefined;
  const adminHash = getSetting.get('admin_pin_hash') as { value: string } | undefined;

  let role: 'edit' | 'admin' | null = null;
  if (editHash && hashed === editHash.value) role = 'edit';
  else if (adminHash && hashed === adminHash.value) role = 'admin';

  res.json({ valid: role !== null, role });
});

export default router;
