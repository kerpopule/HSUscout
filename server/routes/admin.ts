import { Router, Request, Response } from 'express';
import { clearAllData } from '../db.js';
import { pinAuth } from '../middleware/pinAuth.js';

const router = Router();

router.delete('/admin/all-data', pinAuth, (_req: Request, res: Response) => {
  clearAllData();
  res.json({ ok: true });
});

export default router;
