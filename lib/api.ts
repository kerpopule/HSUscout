import { PitData, MatchData } from '../types';

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
