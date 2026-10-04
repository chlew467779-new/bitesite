/* bitesite/app/api/merchant/restaurants/[merchantId]/currency/route.ts */

/**
 * Owner price currency (#24, Singapore): GET `{ currency }`; POST `{ currency: 'MYR' | 'SGD' }`
 * changes how menu prices are shown (RM or S$) at once, without review. The database checks the
 * Owner and the restaurant's state again (merchant_currency_set) and audits the change.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { loadOwnedMerchants, requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { mapFieldRpcError } from '@/lib/merchant-field-patch-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const owned = await loadOwnedMerchants(auth.user.id);
  if ('response' in owned) return owned.response;
  if (!owned.merchants.some((m) => m.id === merchantId.toLowerCase())) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.from('merchants').select('currency').eq('id', merchantId).maybeSingle();
  if (error || !data) {
    if (error) console.error('merchant currency read failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the currency.');
  }
  return NextResponse.json({ data: { currency: data.currency } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const currency = body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 1 ? (body as { currency?: unknown }).currency : undefined;
  if (currency !== 'MYR' && currency !== 'SGD') return errorResponse(400, 'VALIDATION_FAILED', 'Choose RM or S$.');
  const { data, error } = await supabase.rpc('merchant_currency_set', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId, p_currency: currency });
  if (error) {
    const mapped = mapFieldRpcError(error);
    if (mapped.status === 500) console.error('merchant_currency_set failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  return NextResponse.json({ data });
}
