/* bitesite/app/api/merchant/restaurants/[merchantId]/links/route.ts */

/**
 * Owner links: GET the current links and recent requests; POST
 * `{ requestId, action: 'request', field, url }` to ask BiteSite for a link change (nothing public
 * changes until Admin approves) or `{ requestId, action: 'withdraw', linkRequestId }`.
 * The Owner is the verified Supabase user; the database rechecks ownership and state under lock.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_LINK_BODY_BYTES, mapLinkRpcError, parseOwnerLinkRequest } from '@/lib/merchant-links-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function rpcFailure(error: { message: string }, label: string, extra: Record<string, unknown> = {}) {
  const mapped = mapLinkRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message, extra);
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_links_read', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId });
  if (error) return rpcFailure(error, 'merchant_links_read');
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_LINK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseOwnerLinkRequest(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const actor = { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId, p_request_id: parsed.requestId };
  const { data, error } = parsed.action === 'request'
    ? await supabase.rpc('merchant_link_request_submit', { ...actor, p_field: parsed.field, p_url: parsed.url })
    : await supabase.rpc('merchant_link_request_withdraw', { ...actor, p_link_request_id: parsed.linkRequestId });
  if (error) return rpcFailure(error, `merchant_link_${parsed.action}`, { requestId: parsed.requestId });
  return NextResponse.json({ data, requestId: parsed.requestId });
}
