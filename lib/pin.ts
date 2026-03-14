export type PinType = 'edit' | 'admin';

const API_BASE = '/api';
const EDIT_PIN_CACHE_KEY = 'hsuscout_edit_pin_cache';
const ADMIN_PIN_CACHE_KEY = 'hsuscout_admin_pin_cache';
const PIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function pinStatus(): Promise<{ isSet: boolean }> {
  const res = await fetch(`${API_BASE}/pin/status`);
  if (!res.ok) throw new Error('Failed to check PIN status');
  return res.json();
}

export async function pinVerify(pin: string): Promise<{ valid: boolean; role?: 'edit' | 'admin' }> {
  const res = await fetch(`${API_BASE}/pin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error('Failed to verify PIN');
  return res.json();
}

function cacheKeyFor(type: PinType): string {
  return type === 'admin' ? ADMIN_PIN_CACHE_KEY : EDIT_PIN_CACHE_KEY;
}

export function getCachedPin(type: PinType): string | null {
  try {
    const raw = sessionStorage.getItem(cacheKeyFor(type));
    if (!raw) return null;
    const { pin, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      sessionStorage.removeItem(cacheKeyFor(type));
      return null;
    }
    return pin;
  } catch {
    return null;
  }
}

export function cachePin(pin: string, type: PinType): void {
  sessionStorage.setItem(cacheKeyFor(type), JSON.stringify({
    pin,
    expires: Date.now() + PIN_CACHE_TTL,
  }));
}

export function clearPinCache(): void {
  sessionStorage.removeItem(EDIT_PIN_CACHE_KEY);
  sessionStorage.removeItem(ADMIN_PIN_CACHE_KEY);
}
