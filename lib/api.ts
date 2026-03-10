import { PitData, MatchData, Team } from '../types';

const API_BASE = '/api';
const HEALTH_TIMEOUT = 2000;

let deviceId = localStorage.getItem('smoky_scout_device_id');
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem('smoky_scout_device_id', deviceId);
}

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Device-Id': deviceId!,
});

export async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchPitData(): Promise<Record<number, PitData>> {
  const res = await fetch(`${API_BASE}/pit-data`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch pit data');
  return res.json();
}

export async function savePitData(data: PitData): Promise<void> {
  const res = await fetch(`${API_BASE}/pit-data`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save pit data');
}

export async function fetchMatchData(): Promise<MatchData[]> {
  const res = await fetch(`${API_BASE}/match-data`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch match data');
  return res.json();
}

export async function saveMatchData(data: MatchData): Promise<void> {
  const res = await fetch(`${API_BASE}/match-data`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save match data');
}

export async function syncQueue(items: { type: 'pit' | 'match'; data: any }[]): Promise<void> {
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('Failed to sync');
}

export async function updatePitData(data: PitData, pin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/pit-data/${data.teamNumber}`, {
    method: 'PUT',
    headers: { ...headers(), 'X-Pin': pin },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update pit data');
}

export async function deletePitData(teamNumber: number, pin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/pit-data/${teamNumber}`, {
    method: 'DELETE',
    headers: { ...headers(), 'X-Pin': pin },
  });
  if (!res.ok) throw new Error('Failed to delete pit data');
}

export async function updateMatchDataOnServer(data: MatchData, pin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/match-data/${data.id}`, {
    method: 'PUT',
    headers: { ...headers(), 'X-Pin': pin },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update match data');
}

export async function deleteMatchData(id: string, pin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/match-data/${id}`, {
    method: 'DELETE',
    headers: { ...headers(), 'X-Pin': pin },
  });
  if (!res.ok) throw new Error('Failed to delete match data');
}

export async function clearAllServerData(pin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/all-data`, {
    method: 'DELETE',
    headers: { ...headers(), 'X-Pin': pin },
  });
  if (!res.ok) throw new Error('Failed to clear server data');
}

export interface TBAEventSimple {
  key: string;
  name: string;
  start_date: string;
  end_date: string;
  event_code: string;
  city: string | null;
  state_prov: string | null;
  country: string | null;
  year: number;
}

export interface TBATeamSimple {
  key: string;
  team_number: number;
  nickname: string;
  name: string;
  city: string | null;
  state_prov: string | null;
  country: string | null;
}

export interface TBAContext {
  season: number | null;
  eventKey: string | null;
}

const tbaToTeam = (team: TBATeamSimple): Team => ({
  number: team.team_number,
  name: team.nickname || team.name,
  location: [team.city, team.state_prov, team.country].filter(Boolean).join(', '),
});

export async function fetchTbaEventsByYear(year: number): Promise<TBAEventSimple[]> {
  const res = await fetch(`${API_BASE}/tba/events/${year}` , { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch TBA events' }));
    throw new Error(err.error || 'Failed to fetch TBA events');
  }
  return res.json();
}

export async function fetchTbaTeamsForEvent(eventKey: string): Promise<Team[]> {
  const res = await fetch(`${API_BASE}/tba/event/${encodeURIComponent(eventKey)}/teams`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch TBA teams' }));
    throw new Error(err.error || 'Failed to fetch TBA teams');
  }
  const teams = await res.json() as TBATeamSimple[];
  return teams.map(tbaToTeam);
}

export async function fetchTbaMatchesForEvent(eventKey: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/tba/event/${encodeURIComponent(eventKey)}/matches`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch TBA matches' }));
    throw new Error(err.error || 'Failed to fetch TBA matches');
  }
  return res.json();
}

export async function fetchTbaContext(): Promise<TBAContext> {
  const res = await fetch(`${API_BASE}/tba/context`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch TBA context' }));
    throw new Error(err.error || 'Failed to fetch TBA context');
  }
  return res.json();
}

export async function saveTbaContext(context: TBAContext): Promise<TBAContext> {
  const res = await fetch(`${API_BASE}/tba/context`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(context),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save TBA context' }));
    throw new Error(err.error || 'Failed to save TBA context');
  }
  return res.json();
}

// --- TBA Rankings/OPRs/Alliances ---

export interface TBARankingRecord {
  losses: number;
  wins: number;
  ties: number;
}

export interface TBARanking {
  rank: number;
  team_key: string;
  record: TBARankingRecord;
  matches_played: number;
  sort_orders: number[];
  extra_stats: number[];
}

export interface TBARankings {
  rankings: TBARanking[];
  sort_order_info: { name: string; precision: number }[];
  extra_stats_info: { name: string; precision: number }[];
}

export interface TBAOprs {
  oprs: Record<string, number>;
  dprs: Record<string, number>;
  ccwms: Record<string, number>;
}

export interface TBAAlliance {
  name: string | null;
  picks: string[];
  declines: string[];
  status?: {
    level: string;
    status: string;
    record?: TBARankingRecord;
  };
}

export interface TBAMatch {
  key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
  winning_alliance: string;
  time: number;
  actual_time: number | null;
  predicted_time: number;
}

export async function fetchTbaRankings(eventKey: string): Promise<TBARankings | null> {
  const res = await fetch(`${API_BASE}/tba/event/${encodeURIComponent(eventKey)}/rankings`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch TBA rankings' }));
    throw new Error(err.error || 'Failed to fetch TBA rankings');
  }
  return res.json();
}

export async function fetchTbaOprs(eventKey: string): Promise<TBAOprs | null> {
  const res = await fetch(`${API_BASE}/tba/event/${encodeURIComponent(eventKey)}/oprs`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch TBA OPRs' }));
    throw new Error(err.error || 'Failed to fetch TBA OPRs');
  }
  return res.json();
}

export async function fetchTbaTeamEvents(teamNumber: number, year: number): Promise<TBAEventSimple[]> {
  const res = await fetch(`${API_BASE}/tba/team/${teamNumber}/events/${year}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch team events' }));
    throw new Error(err.error || 'Failed to fetch team events');
  }
  return res.json();
}

export async function fetchTbaTeamMatches(teamNumber: number, year: number): Promise<TBAMatch[]> {
  const res = await fetch(`${API_BASE}/tba/team/${teamNumber}/matches/${year}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch team matches' }));
    throw new Error(err.error || 'Failed to fetch team matches');
  }
  return res.json();
}

export async function fetchTbaAlliances(eventKey: string): Promise<TBAAlliance[]> {
  const res = await fetch(`${API_BASE}/tba/event/${encodeURIComponent(eventKey)}/alliances`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch TBA alliances' }));
    throw new Error(err.error || 'Failed to fetch TBA alliances');
  }
  return res.json();
}
