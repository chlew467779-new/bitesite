/* bitesite/app/api/admin/merchants/[merchantId]/slug/route.ts */

/**
 * Admin web address (slug) of one restaurant: GET the current address and the old addresses that
 * redirect to it; PUT `{ requestId, slug, expected }` to rename (compare-and-set on the address the
 * editor showed). The old address keeps working as a permanent redirect.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL, isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_SLUG_BODY_BYTES, mapSlugRpcError, parseSlugChange } from '@/lib/merchant-slug-core.mjs';

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
  const { data, error } = await supabase.rpc('merchant_slug_read', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId });
  if (error) {
    const mapped = mapSlugRpcError(error);
    if (mapped.status === 500) console.error('merchant_slug_read failed:', error.message);
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
    body = await readBoundedJson(request, MAX_SLUG_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseSlugChange(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_slug_change', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId,
    p_request_id: parsed.requestId, p_new_slug: parsed.slug, p_expected_slug: parsed.expected,
  });
  if (error) {
    const mapped = mapSlugRpcError(error);
    if (mapped.status === 500) console.error('merchant_slug_change failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }
  const result = data as { status?: string; slug?: string; previousSlug?: string };
  if (result.status === 'conflict') {
    return errorResponse(409, 'FIELD_CONFLICT', 'The web address was changed meanwhile. Check the current address and try again.', { current: result.slug, requestId: parsed.requestId });
  }
  if (result.status === 'applied') {
    // Old address now redirects; new address, home, sitemap and Story pages show the new one.
    if (result.previousSlug) revalidatePath(`/store/${result.previousSlug}`);
    if (result.slug) revalidatePath(`/store/${result.slug}`);
    revalidatePath('/');
    revalidatePath('/sitemap.xml');
    revalidatePath('/stories', 'layout');
  }
  return NextResponse.json({ data: result, requestId: parsed.requestId });
}
