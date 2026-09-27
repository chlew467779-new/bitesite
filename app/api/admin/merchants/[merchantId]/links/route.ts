/* bitesite/app/api/admin/merchants/[merchantId]/links/route.ts */

/**
 * Admin links for one restaurant: GET current links and recent Owner requests; PUT
 * `{ requestId, field, url, expected }` to set a link directly (compare-and-set on the value the
 * editor showed; a pending Owner request for that link is superseded).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL, isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_LINK_BODY_BYTES, mapLinkRpcError, parseAdminLinkSet } from '@/lib/merchant-links-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : errorResponse(401, 'AUTH_REQUIRED', 'Unauthorized');
}

export async function GET(request: NextRequest, { params }: Context) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_links_read', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId });
  if (error) {
    const mapped = mapLinkRpcError(error);
    if (mapped.status === 500) console.error('merchant_links_read failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const denied = adminDenied(request);
  if (denied) return denied;
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
  const parsed = parseAdminLinkSet(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_link_admin_set', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId, p_request_id: parsed.requestId,
    p_field: parsed.field, p_url: parsed.url, p_expected: parsed.expected,
  });
  if (error) {
    const mapped = mapLinkRpcError(error);
    if (mapped.status === 500) console.error('merchant_link_admin_set failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }
  const result = data as { status: string; current?: string | null; value?: string | null };
  if (result.status === 'conflict') {
    return errorResponse(409, 'FIELD_CONFLICT', 'This link changed in another session. The latest value is shown now.', { current: result.current ?? null, requestId: parsed.requestId });
  }
  if (result.status === 'applied') {
    const { data: row } = await supabase.from('merchants').select('slug').eq('id', merchantId).maybeSingle();
    if (row?.slug) revalidatePath(`/store/${row.slug}`);
  }
  return NextResponse.json({ data: result, requestId: parsed.requestId });
}
