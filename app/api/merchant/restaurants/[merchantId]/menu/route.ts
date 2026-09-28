/* bitesite/app/api/merchant/restaurants/[merchantId]/menu/route.ts */

/**
 * Owner menu editing (M3a): GET the restaurant's categories and dishes, POST one menu change
 * `{ requestId, op }`. The Owner is the verified Supabase user; public.merchant_menu_apply checks,
 * under lock, that this user is the active Owner and that the restaurant is writable, validates
 * the change and replays a repeated requestId. Every reply carries the fresh menu.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_MENU_BODY_BYTES, mapMenuRpcError, menuResponse, parseMenuRequest } from '@/lib/merchant-menu-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_menu_read', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId });
  if (error) {
    const mapped = mapMenuRpcError(error);
    if (mapped.status === 500) console.error('merchant_menu_read failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  const result = data as { menu: unknown; public: boolean };
  return NextResponse.json({ menu: result.menu, public: result.public }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');

  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_MENU_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseMenuRequest(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);

  const { data, error } = await supabase.rpc('merchant_menu_apply', {
    p_actor_type: 'owner',
    p_actor_id: auth.user.id,
    p_merchant_id: merchantId,
    p_request_id: parsed.requestId,
    p_op: parsed.op,
  });
  if (error) {
    const mapped = mapMenuRpcError(error);
    if (mapped.status === 500) console.error('merchant_menu_apply failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }
  if ((data as { status?: string })?.status === 'applied') {
    const { data: row } = await supabase.from('merchants').select('slug').eq('id', merchantId).maybeSingle();
    if (row?.slug) revalidatePath(`/store/${row.slug}`);
  }
  const response = menuResponse(data, parsed.requestId);
  return NextResponse.json(response.body, { status: response.status });
}
