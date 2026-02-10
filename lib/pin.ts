const API_BASE = '/api';
const PIN_CACHE_KEY = 'hsuscout_pin_cache';
const PIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function pinStatus(): Promise<{ isSet: boolean }> {
  const res = await fetch(`${API_BASE}/pin/status`);
  if (!res.ok) throw new Error('Failed to check PIN status');
  return res.json();
}

export async function pinSetup(pin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/pin/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Setup failed' }));
    throw new Error(err.error);
  }
}

export async function pinVerify(pin: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/pin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error('Failed to verify PIN');
  const data = await res.json();
  return data.valid;
}

export function getCachedPin(): string | null {
  try {
    const raw = sessionStorage.getItem(PIN_CACHE_KEY);
    if (!raw) return null;
    const { pin, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      sessionStorage.removeItem(PIN_CACHE_KEY);
      return null;
    }
    return pin;
  } catch {
    return null;
  }
}

export function cachePin(pin: string): void {
  sessionStorage.setItem(PIN_CACHE_KEY, JSON.stringify({
    pin,
    expires: Date.now() + PIN_CACHE_TTL,
  }));
}

export function clearPinCache(): void {
  sessionStorage.removeItem(PIN_CACHE_KEY);
}
