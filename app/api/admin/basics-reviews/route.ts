/* bitesite/app/api/admin/basics-reviews/route.ts */

/**
 * Admin queue for Owner name/address/cuisine change requests: GET pending requests (oldest
 * first); POST `{ requestId, basicsRequestId, decision: 'approve'|'reject', note }`. Approval
 * applies every requested field at once, only if none changed since the Owner asked; rejection
 * needs a note the Owner sees.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { MAX_BASICS_BODY_BYTES, mapBasicsRpcError, parseBasicsReview } from '@/lib/merchant-basics-core.mjs';
import { deliverSoon } from '@/app/api/_lib/notification-delivery';

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
  const { data, error } = await supabase.rpc('merchant_basics_queue', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL });
  if (error) {
    console.error('merchant_basics_queue failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the change requests.');
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_BASICS_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseBasicsReview(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_basics_review', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_request_id: parsed.requestId,
    p_basics_request_id: parsed.basicsRequestId, p_decision: parsed.decision, p_note: parsed.note,
  });
  if (error) {
    const mapped = mapBasicsRpcError(error);
    if (mapped.status === 500) console.error('merchant_basics_review failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }
  const result = data as { decision?: string; slug?: string };
  if (result.decision === 'approve' && result.slug) {
    revalidatePath(`/store/${result.slug}`);
    revalidatePath('/');
  }
  deliverSoon();
  return NextResponse.json({ data: result, requestId: parsed.requestId });
}
