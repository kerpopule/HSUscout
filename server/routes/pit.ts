import { Router, Request, Response } from 'express';
import { getAllPitData, upsertPitData, updatePitData, deletePitByTeam } from '../db.js';
import { pinAuth } from '../middleware/pinAuth.js';

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

router.put('/pit-data/:teamNumber', pinAuth, (req: Request, res: Response) => {
  const teamNumber = parseInt(req.params.teamNumber as string);
  const pitData = req.body;
  if (!pitData || !teamNumber) {
    res.status(400).json({ error: 'Missing data' });
    return;
  }
  updatePitData.run({
    team_number: teamNumber,
    data: JSON.stringify(pitData),
    last_updated: pitData.lastUpdated || Date.now(),
    source_device: req.headers['x-device-id'] || 'unknown',
  });
  res.json({ ok: true });
});

router.delete('/pit-data/:teamNumber', pinAuth, (req: Request, res: Response) => {
  const teamNumber = parseInt(req.params.teamNumber as string);
  if (!teamNumber) {
    res.status(400).json({ error: 'Invalid team number' });
    return;
  }
  deletePitByTeam.run(teamNumber);
  res.json({ ok: true });
});

export default router;
