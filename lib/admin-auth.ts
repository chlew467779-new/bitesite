import { createHmac, timingSafeEqual } from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function generateAdminToken(): string {
  if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD not set');
  const ts = Date.now();
  const sig = createHmac('sha256', ADMIN_PASSWORD).update(String(ts)).digest('hex').slice(0, 16);
  const payload = JSON.stringify({ ts, sig });
  return Buffer.from(payload).toString('base64url');
}

export function verifyAdminToken(token: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  try {
    const payload = Buffer.from(token, 'base64url').toString();
    const { ts, sig } = JSON.parse(payload);
    
    if (Date.now() - ts > SESSION_DURATION_MS) return false;
    
    const expected = createHmac('sha256', ADMIN_PASSWORD).update(String(ts)).digest('hex').slice(0, 16);
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
