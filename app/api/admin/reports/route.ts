/* bitesite/app/api/admin/reports/route.ts */

/**
 * Admin Reports inbox: GET `?status=new|resolved|dismissed` (all when omitted), newest first, with
 * counts; PATCH `{ id, status, note? }` to resolve, dismiss or reopen. Visitor reports are never
 * applied automatically; the Admin fixes the page with the usual tools.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { MAX_REPORT_BODY_BYTES, REPORT_STATUSES, mapReportRpcError, parseReportDecision } from '@/lib/public-report-core.mjs';

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : errorResponse(401, 'AUTH_REQUIRED', 'Unauthorized');
}

export async function GET(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const status = request.nextUrl.searchParams.get('status');
  if (status !== null && !(REPORT_STATUSES as readonly string[]).includes(status)) return errorResponse(400, 'VALIDATION_FAILED', 'Unknown status.');
  const { data, error } = await supabase.rpc('public_report_queue', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_status: status });
  if (error) {
    console.error('public_report_queue failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the reports.');
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_REPORT_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseReportDecision(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('public_report_decide', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_id: parsed.id, p_status: parsed.status, p_note: parsed.note });
  if (error) {
    const mapped = mapReportRpcError(error);
    if (mapped.status === 500) console.error('public_report_decide failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  return NextResponse.json({ data });
}
