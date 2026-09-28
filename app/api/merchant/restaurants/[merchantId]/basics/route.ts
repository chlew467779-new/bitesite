/* bitesite/app/api/merchant/restaurants/[merchantId]/basics/route.ts */

/**
 * Owner listing basics after approval: GET the current name/address/cuisine, whether a change must
 * be requested, and recent requests; POST `{ requestId, action: 'request', changes }` to ask
 * BiteSite for a change (nothing public changes until Admin approves) or
 * `{ requestId, action: 'withdraw', basicsRequestId }`.
 * The Owner is the verified Supabase user; the database rechecks ownership and state under lock.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_BASICS_BODY_BYTES, mapBasicsRpcError, parseOwnerBasicsRequest } from '@/lib/merchant-basics-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function rpcFailure(error: { message: string }, label: string, extra: Record<string, unknown> = {}) {
  const mapped = mapBasicsRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message, extra);
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_basics_read', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId });
  if (error) return rpcFailure(error, 'merchant_basics_read');
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_BASICS_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseOwnerBasicsRequest(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const actor = { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId, p_request_id: parsed.requestId };
  const { data, error } = parsed.action === 'request'
    ? await supabase.rpc('merchant_basics_request_submit', { ...actor, p_changes: parsed.changes })
    : await supabase.rpc('merchant_basics_request_withdraw', { ...actor, p_basics_request_id: parsed.basicsRequestId });
  if (error) return rpcFailure(error, `merchant_basics_${parsed.action}`, { requestId: parsed.requestId });
  return NextResponse.json({ data, requestId: parsed.requestId });
}
