import { Router, Request, Response } from 'express';
import { getAllPitData, upsertPitData } from '../db.js';

const router = Router();

router.get('/pit-data', (_req: Request, res: Response) => {
  const rows = getAllPitData.all() as { team_number: number; data: string }[];
  const result: Record<number, any> = {};
  for (const row of rows) {
    result[row.team_number] = JSON.parse(row.data);
  }
  res.json(result);
});

router.post('/pit-data', (req: Request, res: Response) => {
  const pitData = req.body;
  if (!pitData || !pitData.teamNumber) {
    res.status(400).json({ error: 'Missing teamNumber' });
    return;
  }
  upsertPitData.run({
    team_number: pitData.teamNumber,
    data: JSON.stringify(pitData),
    last_updated: pitData.lastUpdated || Date.now(),
    source_device: req.headers['x-device-id'] || 'unknown',
  });
  res.json({ ok: true });
});

export default router;
