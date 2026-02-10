import { Router, Request, Response } from 'express';
import { getAllMatchData, insertMatchData, updateMatchData, deleteMatchById } from '../db.js';
import { pinAuth } from '../middleware/pinAuth.js';

const router = Router();

router.get('/match-data', (_req: Request, res: Response) => {
  const rows = getAllMatchData.all() as { data: string }[];
  const result = rows.map(r => JSON.parse(r.data));
  res.json(result);
});

router.post('/match-data', (req: Request, res: Response) => {
  const matchData = req.body;
  if (!matchData || !matchData.id || !matchData.matchNumber || !matchData.teamNumber) {
    res.status(400).json({ error: 'Missing required match fields' });
    return;
  }
  insertMatchData.run({
    id: matchData.id,
    match_number: matchData.matchNumber,
    team_number: matchData.teamNumber,
    data: JSON.stringify(matchData),
    timestamp: matchData.timestamp || Date.now(),
    source_device: req.headers['x-device-id'] || 'unknown',
  });
  res.json({ ok: true });
});

router.put('/match-data/:id', pinAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const matchData = req.body;
  if (!matchData || !id) {
    res.status(400).json({ error: 'Missing data' });
    return;
  }
  updateMatchData.run({
    id,
    match_number: matchData.matchNumber,
    team_number: matchData.teamNumber,
    data: JSON.stringify(matchData),
    timestamp: matchData.timestamp || Date.now(),
    source_device: req.headers['x-device-id'] || 'unknown',
  });
  res.json({ ok: true });
});

router.delete('/match-data/:id', pinAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Missing match ID' });
    return;
  }
  deleteMatchById.run(id);
  res.json({ ok: true });
});

export default router;
