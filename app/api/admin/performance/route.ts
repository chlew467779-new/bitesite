/* bitesite/app/api/admin/performance/route.ts */

/**
 * Admin Overview (dashboard phase 2): GET ?days=7|30|90 → public.admin_performance_summary.
 * KPIs against the previous period, daily views/contacts, restaurants ranked by views with their
 * contacts, and searches that found nothing. Computed in the database, so no row cap applies and
 * no visitor hashes reach the browser.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { parseDays } from '@/lib/admin-performance-core.mjs';

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
  }
  const days = parseDays(new URL(request.url).searchParams.get('days'));
  const { data, error } = await supabase.rpc('admin_performance_summary', { p_days: days });
  if (error) {
    console.error('performance summary:', error.message);
    return NextResponse.json({ error: { code: 'UNAVAILABLE', message: 'The performance summary could not be loaded. Try again in a minute.' } }, { status: 503 });
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
