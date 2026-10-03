/* bitesite/app/api/admin/site-errors/route.ts */

/**
 * Admin "Site Errors" (SYNC-070). GET `?status=new|resolved` (default new), most recent first,
 * with the count per status; PATCH `{ ids, status }` marks one or many resolved (or new again).
 * Before the migration runs, GET answers `{ available: false }` instead of failing.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { parseSiteErrorUpdate, SITE_ERROR_STATUSES } from '@/lib/site-errors-core.mjs';

const COLUMNS = 'id,source,message,page_path,occurrences,first_seen_at,last_seen_at,status,resolved_at';
const noStore = { 'Cache-Control': 'no-store' };

function unauthorized(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
}

/** PostgREST answers 42P01 / PGRST205 while the table does not exist yet. */
const tableMissing = (code: string | undefined) => code === '42P01' || code === 'PGRST205';

export async function GET(request: NextRequest) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const status = request.nextUrl.searchParams.get('status') ?? 'new';
  if (!(SITE_ERROR_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Unknown status.' } }, { status: 400 });
  const count = (s: string) => supabase.from('site_errors').select('id', { count: 'exact', head: true }).eq('status', s);
  const [list, newCount, resolvedCount] = await Promise.all([
    supabase.from('site_errors').select(COLUMNS).eq('status', status).order('last_seen_at', { ascending: false }).limit(200),
    count('new'),
    count('resolved'),
  ]);
  const failed = [list, newCount, resolvedCount].find((r) => r.error);
  if (failed?.error) {
    if (tableMissing(failed.error.code)) return NextResponse.json({ data: { available: false, items: [], counts: { new: 0, resolved: 0 } } }, { headers: noStore });
    console.error('site errors list failed:', failed.error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load the site errors.' } }, { status: 500 });
  }
  return NextResponse.json({
    data: { available: true, items: list.data ?? [], counts: { new: newCount.count ?? 0, resolved: resolvedCount.count ?? 0 } },
  }, { headers: noStore });
}

export async function PATCH(request: NextRequest) {
  const authError = unauthorized(request);
  if (authError) return authError;
  let body: unknown;
  try {
    body = await readBoundedJson(request, 8 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: { code: 'BODY_TOO_LARGE', message: error.message } }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: { code: 'INVALID_JSON', message: error.message } }, { status: 400 });
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid request.' } }, { status: 400 });
  }
  const parsed = parseSiteErrorUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: { code: parsed.code, message: parsed.message } }, { status: parsed.status });
  const { data, error } = await supabase.from('site_errors')
    .update({ status: parsed.status, resolved_at: parsed.status === 'resolved' ? new Date().toISOString() : null })
    .in('id', parsed.ids).select('id');
  if (error) {
    console.error('site errors update failed:', error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not update the site errors.' } }, { status: 500 });
  }
  return NextResponse.json({ data: { updated: data?.length ?? 0 } });
}
