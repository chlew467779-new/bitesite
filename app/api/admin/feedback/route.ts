/* bitesite/app/api/admin/feedback/route.ts */

/**
 * Admin feedback inbox: GET `?status=new|read|resolved` (all when omitted), newest first, with
 * counts; PATCH `{ id, status, reply }` to mark read/resolved and optionally reply (the Owner sees
 * the reply on the dashboard).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { FEEDBACK_STATUSES, MAX_FEEDBACK_BODY_BYTES, mapFeedbackRpcError, parseFeedbackUpdate } from '@/lib/merchant-feedback-core.mjs';

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
  if (status !== null && !(FEEDBACK_STATUSES as readonly string[]).includes(status)) return errorResponse(400, 'VALIDATION_FAILED', 'Unknown status.');
  const { data, error } = await supabase.rpc('merchant_feedback_queue', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_status: status });
  if (error) {
    console.error('merchant_feedback_queue failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the feedback.');
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_FEEDBACK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseFeedbackUpdate(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_feedback_update', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_feedback_id: parsed.id, p_status: parsed.status, p_reply: parsed.reply,
  });
  if (error) {
    const mapped = mapFeedbackRpcError(error);
    if (mapped.status === 500) console.error('merchant_feedback_update failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  return NextResponse.json({ data });
}
