import { Router, Request, Response } from 'express';
import { getSetting, getTbaCache, setSetting, setTbaCache } from '../db.js';

const TBA_API_BASE = 'https://www.thebluealliance.com/api/v3';
const TBA_CONTEXT_KEY = 'tba_context';

const router = Router();

interface TbaCacheRow {
  etag: string | null;
  data: string;
  status: number;
  fetched_at: number;
}

interface TbaContext {
  season: number | null;
  eventKey: string | null;
}

function parseTbaContext(): TbaContext {
  const raw = getSetting.get(TBA_CONTEXT_KEY) as { value: string } | undefined;
  if (!raw?.value) return { season: null, eventKey: null };
  try {
    const parsed = JSON.parse(raw.value) as TbaContext;
    const season = typeof parsed.season === 'number' && Number.isFinite(parsed.season) ? parsed.season : null;
    const eventKey = typeof parsed.eventKey === 'string' && parsed.eventKey.trim() ? parsed.eventKey.trim() : null;
    return { season, eventKey };
  } catch {
    return { season: null, eventKey: null };
  }
}

function buildCacheKey(path: string, query?: string): string {
  return `${path}${query ? `?${query}` : ''}`;
}

async function fetchFromTba(cacheKey: string, endpoint: string, ifNoneMatch?: string | null): Promise<{ data: any; fromCache: boolean }> {
  const apiKey = process.env.TBA_API_KEY?.trim();
  if (!apiKey) {
    const cache = getTbaCache.get(cacheKey) as TbaCacheRow | undefined;
    if (!cache) {
      throw new Error('Missing TBA_API_KEY in server environment.');
    }
    return { data: JSON.parse(cache.data), fromCache: true };
  }

  const headers: Record<string, string> = {
    'X-TBA-Auth-Key': apiKey,
    Accept: 'application/json',
  };

  const cached = getTbaCache.get(cacheKey) as TbaCacheRow | undefined;
  const etag = cached?.etag || ifNoneMatch;
  if (etag) headers['If-None-Match'] = etag;

  const res = await fetch(`${TBA_API_BASE}${endpoint}`, { headers });
  if (res.status === 304 && cached) {
    return { data: JSON.parse(cached.data), fromCache: true };
  }

  if (!res.ok) {
    if (cached) {
      return { data: JSON.parse(cached.data), fromCache: true };
    }
    const body = await res.text().catch(() => '');
    throw new Error(`TBA request failed (${res.status}) ${body || 'Unknown error'}`);
  }

  const bodyText = await res.text();
  const payload = bodyText ? JSON.parse(bodyText) : null;
  setTbaCache.run({
    cache_key: cacheKey,
    etag: res.headers.get('etag'),
    data: bodyText,
    status: res.status,
    fetched_at: Date.now(),
  });

  return { data: payload, fromCache: false };
}

router.get('/tba/events/:year', async (req: Request, res: Response) => {
  const year = parseInt(req.params.year, 10);
  if (!Number.isFinite(year)) {
    res.status(400).json({ error: 'Invalid year' });
    return;
  }

  try {
    const { data } = await fetchFromTba(`events/${year}/simple`, `/events/${year}/simple`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load TBA events' });
  }
});

router.get('/tba/event/:eventKey/teams', async (req: Request, res: Response) => {
  const eventKey = req.params.eventKey?.trim();
  if (!eventKey) {
    res.status(400).json({ error: 'Missing eventKey' });
    return;
  }

  try {
    const { data } = await fetchFromTba(`event/${eventKey}/teams/simple`, `/event/${eventKey}/teams/simple`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load TBA event teams' });
  }
});

router.get('/tba/event/:eventKey/matches', async (req: Request, res: Response) => {
  const eventKey = req.params.eventKey?.trim();
  if (!eventKey) {
    res.status(400).json({ error: 'Missing eventKey' });
    return;
  }

  try {
    const { data } = await fetchFromTba(buildCacheKey(`event/${eventKey}/matches/simple`), `/event/${eventKey}/matches/simple`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load TBA event matches' });
  }
});

router.get('/tba/context', (_req: Request, res: Response) => {
  res.json(parseTbaContext());
});

router.post('/tba/context', (req: Request, res: Response) => {
  const rawSeason = Number(req.body?.season);
  const season = Number.isFinite(rawSeason) ? Math.trunc(rawSeason) : null;
  const rawEventKey = typeof req.body?.eventKey === 'string' ? req.body.eventKey.trim() : '';
  const eventKey = rawEventKey || null;

  if (!Number.isFinite(rawSeason)) {
    res.status(400).json({ error: 'Context requires season' });
    return;
  }

  setSetting.run({
    key: TBA_CONTEXT_KEY,
    value: JSON.stringify({ season, eventKey }),
  });

  res.json({ season, eventKey });
});

router.get('/tba/event/:eventKey/rankings', async (req: Request, res: Response) => {
  const eventKey = String(req.params.eventKey || '').trim();
  if (!eventKey) {
    res.status(400).json({ error: 'Missing eventKey' });
    return;
  }

  try {
    const { data } = await fetchFromTba(buildCacheKey(`event/${eventKey}/rankings`), `/event/${eventKey}/rankings`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load TBA rankings' });
  }
});

router.get('/tba/event/:eventKey/oprs', async (req: Request, res: Response) => {
  const eventKey = String(req.params.eventKey || '').trim();
  if (!eventKey) {
    res.status(400).json({ error: 'Missing eventKey' });
    return;
  }

  try {
    const { data } = await fetchFromTba(buildCacheKey(`event/${eventKey}/oprs`), `/event/${eventKey}/oprs`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load TBA OPRs' });
  }
});

router.get('/tba/event/:eventKey/alliances', async (req: Request, res: Response) => {
  const eventKey = String(req.params.eventKey || '').trim();
  if (!eventKey) {
    res.status(400).json({ error: 'Missing eventKey' });
    return;
  }

  try {
    const { data } = await fetchFromTba(buildCacheKey(`event/${eventKey}/alliances`), `/event/${eventKey}/alliances`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load TBA alliances' });
  }
});

router.get('/tba/team/:teamNumber/events/:year', async (req: Request, res: Response) => {
  const teamNumber = parseInt(String(req.params.teamNumber), 10);
  const year = parseInt(String(req.params.year), 10);
  if (!Number.isFinite(teamNumber) || teamNumber < 1) {
    res.status(400).json({ error: 'Invalid team number' });
    return;
  }
  if (!Number.isFinite(year) || year < 1992 || year > new Date().getFullYear() + 1) {
    res.status(400).json({ error: 'Invalid year' });
    return;
  }

  try {
    const cacheKey = buildCacheKey(`team/frc${teamNumber}/events/${year}/simple`);
    const { data } = await fetchFromTba(cacheKey, `/team/frc${teamNumber}/events/${year}/simple`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load team events' });
  }
});

router.get('/tba/team/:teamNumber/matches/:year', async (req: Request, res: Response) => {
  const teamNumber = parseInt(String(req.params.teamNumber), 10);
  const year = parseInt(String(req.params.year), 10);
  if (!Number.isFinite(teamNumber) || teamNumber < 1) {
    res.status(400).json({ error: 'Invalid team number' });
    return;
  }
  if (!Number.isFinite(year) || year < 1992 || year > new Date().getFullYear() + 1) {
    res.status(400).json({ error: 'Invalid year' });
    return;
  }

  try {
    const cacheKey = buildCacheKey(`team/frc${teamNumber}/matches/${year}/simple`);
    const { data } = await fetchFromTba(cacheKey, `/team/frc${teamNumber}/matches/${year}/simple`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to load team matches' });
  }
});

export default router;
