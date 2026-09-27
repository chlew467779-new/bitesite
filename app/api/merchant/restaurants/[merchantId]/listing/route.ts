import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_REVIEW_BODY_BYTES, mapReviewRpcError, parseListingAction } from '@/lib/merchant-review-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function rpcFailure(error: { message: string }, label: string, extra: Record<string, unknown> = {}) {
  const mapped = mapReviewRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message, extra);
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_listing_read', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId });
  if (error) return rpcFailure(error, 'merchant_listing_read');
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_REVIEW_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseListingAction(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const actor = { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId, p_request_id: parsed.requestId };
  // Discarding a never-public draft archives it (merchant_draft_discard); the rest is merchant_listing_apply.
  const { data, error } = parsed.action === 'discard'
    ? await supabase.rpc('merchant_draft_discard', actor)
    : await supabase.rpc('merchant_listing_apply', { ...actor, p_action: parsed.action });
  if (error) return rpcFailure(error, `merchant_listing_${parsed.action}`, { requestId: parsed.requestId });
  if (data?.status === 'applied' && (parsed.action === 'publish' || parsed.action === 'hide')) {
    revalidatePath('/store/' + data.slug);
    if (data.previousSlug) revalidatePath('/store/' + data.previousSlug);
    revalidatePath('/');
    revalidatePath('/sitemap.xml');
  }
  return NextResponse.json({ data, requestId: parsed.requestId });
}
