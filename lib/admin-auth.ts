/* bitesite/lib/admin-auth.ts */


import { createHmac, timingSafeEqual } from 'crypto';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function generateAdminToken(): string {
  if (!ADMIN_SESSION_SECRET) throw new Error('ADMIN_SESSION_SECRET not set');
  const ts = Date.now();
  const sig = createHmac('sha256', ADMIN_SESSION_SECRET).update(String(ts)).digest('hex').slice(0, 16);
  const payload = JSON.stringify({ ts, sig });
  return Buffer.from(payload).toString('base64url');
}

export function verifyAdminToken(token: string): boolean {
  if (!ADMIN_SESSION_SECRET) return false;
  try {
    const payload = Buffer.from(token, 'base64url').toString();
    const { ts, sig } = JSON.parse(payload);
    
    if (Date.now() - ts > SESSION_DURATION_MS) return false;
    
    const expected = createHmac('sha256', ADMIN_SESSION_SECRET).update(String(ts)).digest('hex').slice(0, 16);
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
