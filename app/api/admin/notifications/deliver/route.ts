/* bitesite/app/api/admin/notifications/deliver/route.ts */

/**
 * Send pending notification emails (review submitted / approved / rejected / withdrawn).
 * POST with the Admin session (a manual "send now"), or GET from a scheduler with
 * `Authorization: Bearer <CRON_SECRET>`. Returns { configured, claimed, sent, failed }.
 * Without a configured provider it does nothing (configured: false).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { verifyAdminToken } from '@/lib/admin-auth';
import { deliverNotifications } from '@/app/api/_lib/notification-delivery';

function cronAllowed(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run() {
  try {
    return NextResponse.json({ data: await deliverNotifications() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('notification delivery failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Notifications could not be sent now.' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
  return run();
}

export async function GET(request: NextRequest) {
  if (!cronAllowed(request)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
  return run();
}
