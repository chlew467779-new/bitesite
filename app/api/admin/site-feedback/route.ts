/* bitesite/app/api/admin/site-feedback/route.ts */

/**
 * Admin inbox for visitor feedback about BiteSite. GET `?status=new|done` (default new), oldest
 * first so a batch is worked through in order; PATCH `{ ids, status }` marks one or many at once.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { parseSiteFeedbackUpdate, SITE_FEEDBACK_STATUSES } from '@/lib/site-feedback-core.mjs';

const COLUMNS = 'id,topic,message,page_path,contact_email,status,created_at,decided_at';

function unauthorized(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const status = request.nextUrl.searchParams.get('status') ?? 'new';
  if (!(SITE_FEEDBACK_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Unknown status.' } }, { status: 400 });
  const { data, error } = await supabase.from('site_feedback').select(COLUMNS).eq('status', status)
    .order('created_at', { ascending: status === 'new' }).limit(500);
  if (error) {
    console.error('site feedback list failed:', error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load visitor feedback.' } }, { status: 500 });
  }
  return NextResponse.json({ data: { items: data ?? [] } }, { headers: { 'Cache-Control': 'no-store' } });
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
  const parsed = parseSiteFeedbackUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: { code: parsed.code, message: parsed.message } }, { status: parsed.status });
  const { data, error } = await supabase.from('site_feedback')
    .update({ status: parsed.status, decided_at: parsed.status === 'done' ? new Date().toISOString() : null })
    .in('id', parsed.ids).select('id');
  if (error) {
    console.error('site feedback update failed:', error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not update visitor feedback.' } }, { status: 500 });
  }
  return NextResponse.json({ data: { updated: data?.length ?? 0 } });
}
