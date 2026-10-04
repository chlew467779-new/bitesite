import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readBoundedJson } from '@/lib/bounded-json';
import { validateRestaurantDraft } from '@/lib/merchant-auth-validation.mjs';
import { MERCHANT_TERMS_VERSION } from '@/lib/merchant-terms.mjs';
import { requireMerchantUser, merchantErrorResponse } from '@/app/api/merchant/_lib/merchant-access';
export async function POST(request: NextRequest) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  if (!auth.user.email_confirmed_at || auth.user.is_anonymous) return merchantErrorResponse(403, 'EMAIL_CONFIRMATION_REQUIRED', 'Confirm your email before creating a restaurant.');
  let body: unknown;
  try { body = await readBoundedJson(request, 2048); }
  catch { return merchantErrorResponse(400, 'INVALID_INPUT', 'Enter a restaurant name.'); }
  if (body && typeof body === 'object' && !Array.isArray(body) && 'termsVersion' in body && body.termsVersion !== MERCHANT_TERMS_VERSION)
    return merchantErrorResponse(409, 'TERMS_OUTDATED', 'The terms were updated. Reload the page and accept the current version.');
  const input = validateRestaurantDraft(body);
  if (!input) return merchantErrorResponse(400, 'INVALID_INPUT', 'Enter a restaurant name, accept the terms, and confirm your rights.');
  const { data, error } = await supabaseAdmin.rpc('merchant_restaurant_create_v2', { p_actor_user_id: auth.user.id, p_name: input.name, p_request_id: input.requestId, p_terms_version: input.termsVersion });
  if (error) return merchantErrorResponse(503, 'CREATE_UNAVAILABLE', 'We could not create your draft. Please try again.');
  if (data?.code === 'DRAFT_LIMIT') return merchantErrorResponse(409, 'DRAFT_LIMIT', 'You already have three restaurants in progress. Submit one for review (or finish it) before creating another.');
  if (data?.code === 'TERMS_OUTDATED') return merchantErrorResponse(409, 'TERMS_OUTDATED', 'The terms were updated. Reload the page and accept the current version.');
  if (data?.code) return merchantErrorResponse(data.code === 'AUTH_REQUIRED' ? 403 : 409, data.code, 'This request could not be completed. Try again with a new restaurant name.');
  // Singapore restaurants: set S$ right away. A failure only leaves RM, which the Owner can change in the dashboard.
  if (input.currency === 'SGD' && typeof data?.id === 'string') {
    const { error: currencyError } = await supabaseAdmin.rpc('merchant_currency_set', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: data.id, p_currency: 'SGD' });
    if (currencyError) console.error('merchant_currency_set after create failed:', currencyError.message);
  }
  return NextResponse.json({ merchant: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
