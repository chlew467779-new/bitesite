/* bitesite/app/api/merchant/restaurants/[merchantId]/feedback/route.ts */

/**
 * Owner feedback to the BiteSite team: GET this restaurant's recent feedback (with replies);
 * POST `{ requestId, topic, message }`. Works while suspended or waiting for review, so Owners can
 * always reach the team. The database rechecks the Owner under lock.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_FEEDBACK_BODY_BYTES, mapFeedbackRpcError, parseFeedbackSubmit } from '@/lib/merchant-feedback-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function rpcFailure(error: { message: string }, label: string, extra: Record<string, unknown> = {}) {
  const mapped = mapFeedbackRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message, extra);
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_feedback_list', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId });
  if (error) return rpcFailure(error, 'merchant_feedback_list');
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_FEEDBACK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseFeedbackSubmit(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_feedback_submit', {
    p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId,
    p_request_id: parsed.requestId, p_topic: parsed.topic, p_message: parsed.message,
  });
  if (error) return rpcFailure(error, 'merchant_feedback_submit', { requestId: parsed.requestId });
  return NextResponse.json({ data, requestId: parsed.requestId });
}
