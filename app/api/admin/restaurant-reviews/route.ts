import { NextResponse, type NextRequest } from 'next/server';

import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { MAX_REVIEW_BODY_BYTES, mapReviewRpcError, parseReviewDecision, parseCapacity } from '@/lib/merchant-review-core.mjs';

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : errorResponse(401, 'AUTH_REQUIRED', 'Unauthorized');
}

export async function GET(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { data, error } = await supabase.rpc('merchant_review_queue', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL });
  if (error) {
    console.error('merchant_review_queue failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the restaurant submissions.');
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_REVIEW_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseReviewDecision(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_review_decide', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_request_id: parsed.requestId,
    p_submission_id: parsed.submissionId, p_decision: parsed.decision, p_note: parsed.note,
  });
  if (error) {
    const mapped = mapReviewRpcError(error);
    if (mapped.status === 500) console.error('merchant_review_decide failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }
  return NextResponse.json({ data, requestId: parsed.requestId });
}

export async function PUT(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try { body = await readBoundedJson(request, MAX_REVIEW_BODY_BYTES); }
  catch (error) { return errorResponse(error instanceof RequestBodyTooLargeError ? 413 : 400, 'VALIDATION_FAILED', 'Invalid request.'); }
  const parsed = parseCapacity(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_review_capacity_set', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_capacity: parsed.capacity, p_pilot_capacity: parsed.pilotCapacity ?? null });
  if (error) { const mapped = mapReviewRpcError(error); return errorResponse(mapped.status, mapped.code, mapped.message); }
  return NextResponse.json({ data });
}
