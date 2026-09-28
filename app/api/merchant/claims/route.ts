/* bitesite/app/api/merchant/claims/route.ts */

/**
 * Claim an existing restaurant (signed-in account with a confirmed email). GET `?slug=` returns
 * the restaurant as the claim page shows it plus the account's claims (without a slug: the
 * claims only). POST `?slug=` `{ requestId, action: 'submit', relationship, contactName,
 * contactPhone, evidence }` sends a claim for BiteSite to review; POST `{ requestId, action:
 * 'withdraw', claimId }` withdraws a waiting one. The restaurant comes from the URL and is
 * resolved by the database; the account is the verified Supabase user.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { MAX_CLAIM_BODY_BYTES, isClaimSlug, mapClaimRpcError, parseClaimRequest } from '@/lib/merchant-claim-core.mjs';

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function rpcFailure(error: { message: string }, label: string, extra: Record<string, unknown> = {}) {
  const mapped = mapClaimRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message, extra);
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const slug = request.nextUrl.searchParams.get('slug');
  if (slug !== null && !isClaimSlug(slug)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let target: unknown = null;
  if (slug !== null) {
    const { data, error } = await supabase.rpc('merchant_claim_target', { p_user_id: auth.user.id, p_slug: slug });
    if (error) return rpcFailure(error, 'merchant_claim_target');
    target = data;
  }
  const { data: mine, error } = await supabase.rpc('merchant_claims_mine', { p_user_id: auth.user.id });
  if (error) return rpcFailure(error, 'merchant_claims_mine');
  return NextResponse.json({ data: { target, claims: mine ?? [] } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  if (!auth.user.email || !auth.user.email_confirmed_at) return errorResponse(403, 'EMAIL_NOT_CONFIRMED', 'Confirm your email address first, then try again.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_CLAIM_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseClaimRequest(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);

  if (parsed.action === 'withdraw') {
    const { data, error } = await supabase.rpc('merchant_claim_withdraw', { p_user_id: auth.user.id, p_request_id: parsed.requestId, p_claim_id: parsed.claimId });
    if (error) return rpcFailure(error, 'merchant_claim_withdraw', { requestId: parsed.requestId });
    return NextResponse.json({ data, requestId: parsed.requestId });
  }

  const slug = request.nextUrl.searchParams.get('slug');
  if (!isClaimSlug(slug)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data: target, error: targetError } = await supabase.rpc('merchant_claim_target', { p_user_id: auth.user.id, p_slug: slug });
  if (targetError) return rpcFailure(targetError, 'merchant_claim_target');
  const { data, error } = await supabase.rpc('merchant_claim_submit', {
    p_user_id: auth.user.id,
    p_email: auth.user.email,
    p_request_id: parsed.requestId,
    p_merchant_id: (target as { merchantId: string }).merchantId,
    p_relationship: parsed.relationship,
    p_contact_name: parsed.contactName,
    p_contact_phone: parsed.contactPhone,
    p_evidence: parsed.evidence,
  });
  if (error) return rpcFailure(error, 'merchant_claim_submit', { requestId: parsed.requestId });
  return NextResponse.json({ data, requestId: parsed.requestId });
}
