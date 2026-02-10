import { createHash } from 'crypto';

const SALT = 'hsuscout_pin_v1';

export function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}
