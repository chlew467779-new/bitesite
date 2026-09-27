/* bitesite/app/api/merchant/restaurants/[merchantId]/business-status/route.ts */

/**
 * Owner open / temporarily closed: GET the current status and closure notice; POST
 * `{ requestId, status, note, reopenOn }`. Moved / permanently closed stay with Admin.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { mapClosureRpcError, parseClosureRequest } from '@/lib/merchant-closure-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function rpcFailure(error: { message: string }, label: string, extra: Record<string, unknown> = {}) {
  const mapped = mapClosureRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message, extra);
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_owner_business_status_read', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId });
  if (error) return rpcFailure(error, 'merchant_owner_business_status_read');
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, 2048);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseClosureRequest(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_owner_business_status', {
    p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId, p_request_id: parsed.requestId,
    p_status: parsed.status, p_note: parsed.note, p_reopen_on: parsed.reopenOn,
  });
  if (error) return rpcFailure(error, 'merchant_owner_business_status', { requestId: parsed.requestId });
  const result = data as { status?: string; slug?: string };
  if (result.status === 'applied' && result.slug) {
    revalidatePath(`/store/${result.slug}`);
    revalidatePath('/');
  }
  return NextResponse.json({ data: result, requestId: parsed.requestId });
}
