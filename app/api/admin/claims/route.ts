/* bitesite/app/api/admin/claims/route.ts */

/**
 * Admin restaurant claims: GET pending claims (oldest first) with the restaurant's listed contact
 * details and the claimant's account email; POST `{ requestId, claimId, decision, note }`.
 * Approval makes the claimant the restaurant's Owner (refused if it already has one); rejection
 * needs a note the claimant sees.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { MAX_CLAIM_BODY_BYTES, mapClaimRpcError, parseClaimDecision, type ClaimQueueItem } from '@/lib/merchant-claim-core.mjs';

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
  const { data, error } = await supabase.rpc('merchant_claim_queue', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL });
  if (error) {
    console.error('merchant_claim_queue failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the claims.');
  }
  const items = (data ?? []) as ClaimQueueItem[];
  const emails = new Map<string, string | null>();
  for (const id of new Set(items.map((item) => item.userId))) {
    const { data: user } = await supabase.auth.admin.getUserById(id);
    emails.set(id, user?.user?.email ?? null);
  }
  return NextResponse.json({ data: items.map((item) => ({ ...item, userEmail: emails.get(item.userId) ?? null })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_CLAIM_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseClaimDecision(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_claim_decide', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_request_id: parsed.requestId,
    p_claim_id: parsed.claimId, p_decision: parsed.decision, p_note: parsed.note,
  });
  if (error) {
    const mapped = mapClaimRpcError(error);
    if (mapped.status === 500) console.error('merchant_claim_decide failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }
  return NextResponse.json({ data, requestId: parsed.requestId });
}
