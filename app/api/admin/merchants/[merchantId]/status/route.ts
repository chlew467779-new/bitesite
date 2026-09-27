/* bitesite/app/api/admin/merchants/[merchantId]/status/route.ts */

/**
 * Admin governance (D2-C): read the restaurant's visibility state and publish / hide / suspend /
 * lift a suspension / archive / restore, or set the business status. The actor is the verified Admin session (x-admin-token), recorded as
 * `legacy_admin`. Rules, locking, audit and idempotency all live in
 * public.merchant_governance_apply (one transaction); public pages are refreshed after it commits.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL, isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import {
  MAX_GOVERNANCE_BODY_BYTES,
  governanceResponse,
  mapGovernanceRpcError,
  parseGovernanceRequest,
} from '@/lib/merchant-governance-core.mjs';

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
  const { data, error } = await supabase.rpc('merchant_governance_read', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId });
  if (error) {
    const mapped = mapGovernanceRpcError(error);
    if (mapped.status === 500) console.error('merchant_governance_read failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  const result = data as { revision: number; updatedAt: string; state: unknown };
  return NextResponse.json({ data: { state: result.state, updatedAt: result.updatedAt }, revision: result.revision }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');

  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_GOVERNANCE_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseGovernanceRequest(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);

  const actor = { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId, p_request_id: parsed.requestId };
  const { data, error } = parsed.action === 'set_business_status'
    ? await supabase.rpc('merchant_business_status_set', { ...actor, p_status: parsed.businessStatus, p_reason: parsed.reason })
    : await supabase.rpc('merchant_governance_apply', { ...actor, p_action: parsed.action, p_reason: parsed.reason });
  if (error) {
    const mapped = mapGovernanceRpcError(error);
    if (mapped.status === 500) console.error('merchant_governance_apply failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }

  // Refresh after commit. A replay refreshes again, in case the first response or refresh was lost.
  if ((data as { status?: string })?.status === 'applied') await revalidatePublicMerchant(merchantId);
  const response = governanceResponse(data, parsed.requestId);
  return NextResponse.json(response.body, { status: response.status });
}

/** Every public page that lists or shows restaurants. */
async function revalidatePublicMerchant(merchantId: string) {
  const { data } = await supabase.from('merchants').select('slug').eq('id', merchantId).maybeSingle();
  if (data?.slug) revalidatePath(`/store/${data.slug}`);
  revalidatePath('/');
  revalidatePath('/our-partner');
  revalidatePath('/sitemap.xml');
}
