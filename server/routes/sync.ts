import { Router, Request, Response } from 'express';
import { bulkSync } from '../db.js';

const router = Router();

router.post('/sync', (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'Expected items array' });
    return;
  }

  const deviceId = (req.headers['x-device-id'] as string) || 'unknown';
  const dbItems = items.map((item: any) => {
    if (item.type === 'pit') {
      return {
        type: 'pit' as const,
        payload: {
          team_number: item.data.teamNumber,
          data: JSON.stringify(item.data),
          last_updated: item.data.lastUpdated || Date.now(),
          source_device: deviceId,
        },
      };
    } else {
      return {
        type: 'match' as const,
        payload: {
          id: item.data.id,
          match_number: item.data.matchNumber,
          team_number: item.data.teamNumber,
          data: JSON.stringify(item.data),
          timestamp: item.data.timestamp || Date.now(),
          source_device: deviceId,
        },
      };
    }
  });

  try {
    bulkSync(dbItems);
    res.json({ ok: true, synced: dbItems.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
