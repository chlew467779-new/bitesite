/* bitesite/app/api/merchant/_lib/merchant-access.ts */

/**
 * Shared server access helper for merchant-scoped API routes (master spec §4.3).
 *
 * Every merchant route calls requireMerchantAccess: it verifies the Supabase user from the
 * Bearer token (getUser, never a client-supplied user ID or session object), loads that user's
 * active Owner memberships, and lets lib/merchant-access-core.mjs decide which merchant the
 * request may act on. The merchant ID comes from the `merchantId` query parameter.
 *
 * It lives under app/api/ (a private `_lib` folder, not a route) because it uses the service-role
 * client, which may only be imported there (scripts/check-service-role-usage.mjs). Writes recheck
 * ownership and restaurant state inside their database transaction (D2-A RPCs).
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import {
  MERCHANT_ACCESS_COLUMNS,
  merchantSummary,
  readRequestedMerchantId,
  resolveMerchantAccess,
} from '@/lib/merchant-access-core.mjs';
import type { MerchantAccessRow, MerchantCapability, MerchantRestriction, MerchantSummary } from '@/lib/merchant-access-core.mjs';

export type MerchantAccess = { user: User; merchant: MerchantAccessRow; restriction: MerchantRestriction };
type Denied = { response: NextResponse };

export function merchantErrorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** The verified Supabase user of the request, or a 401 response. */
export async function requireMerchantUser(request: NextRequest): Promise<{ user: User } | Denied> {
  const token = bearerToken(request);
  if (!token) return { response: merchantErrorResponse(401, 'AUTH_REQUIRED', 'Please sign in again.') };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { response: merchantErrorResponse(401, 'AUTH_REQUIRED', 'Please sign in again.') };
  return { user: data.user };
}

/** Merchants of the user's active Owner memberships (all of them, no implicit first choice). */
export async function loadOwnedMerchants(userId: string): Promise<{ merchants: MerchantAccessRow[] } | Denied> {
  const { data, error } = await supabase
    .from('merchant_memberships')
    .select(`merchant:merchants(${MERCHANT_ACCESS_COLUMNS.join(', ')})`)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('role', 'owner');
  if (error) {
    console.error('Merchant membership lookup failed:', error.message);
    return { response: merchantErrorResponse(500, 'INTERNAL_ERROR', 'We could not load your restaurants. Please try again.') };
  }
  const merchants: MerchantAccessRow[] = [];
  for (const row of data ?? []) {
    const value = (row as unknown as { merchant: MerchantAccessRow | MerchantAccessRow[] | null }).merchant;
    for (const merchant of Array.isArray(value) ? value : value ? [value] : []) merchants.push(merchant);
  }
  merchants.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { merchants };
}

export function ownedMerchantSummaries(merchants: readonly MerchantAccessRow[]): MerchantSummary[] {
  return merchants.map(merchantSummary);
}

/** The requested merchant ID from `?merchantId=`, or undefined when absent. */
export function requestedMerchantId(request: NextRequest) {
  return readRequestedMerchantId(request.nextUrl.searchParams.get('merchantId'));
}

/**
 * Authenticate the caller and resolve the merchant the request may act on:
 * 401 signed out, 404 missing/foreign/malformed merchant, 409 several merchants and no ID,
 * 403 write to a suspended or archived merchant.
 */
export async function requireMerchantAccess(
  request: NextRequest,
  capability: MerchantCapability,
): Promise<MerchantAccess | Denied> {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth;
  const owned = await loadOwnedMerchants(auth.user.id);
  if ('response' in owned) return owned;
  const result = resolveMerchantAccess({ merchants: owned.merchants, requestedMerchantId: requestedMerchantId(request), capability });
  if (!result.ok) return { response: merchantErrorResponse(result.status, result.code, result.message) };
  return { user: auth.user, merchant: result.merchant, restriction: result.restriction };
}
