import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readBoundedJson } from '@/lib/bounded-json';
import { validateRestaurantDraft } from '@/lib/merchant-auth-validation.mjs';
import { requireMerchantUser, merchantErrorResponse } from '@/app/api/merchant/_lib/merchant-access';
export async function POST(request: NextRequest) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  if (!auth.user.email_confirmed_at || auth.user.is_anonymous) return merchantErrorResponse(403, 'EMAIL_CONFIRMATION_REQUIRED', 'Confirm your email before creating a restaurant.');
  let input;
  try { input = validateRestaurantDraft(await readBoundedJson(request, 2048)); }
  catch { return merchantErrorResponse(400, 'INVALID_INPUT', 'Enter a restaurant name.'); }
  if (!input) return merchantErrorResponse(400, 'INVALID_INPUT', 'Enter a restaurant name and a valid request ID.');
  const { data, error } = await supabaseAdmin.rpc('merchant_restaurant_create', { p_actor_user_id: auth.user.id, p_name: input.name, p_request_id: input.requestId });
  if (error) return merchantErrorResponse(503, 'CREATE_UNAVAILABLE', 'We could not create your draft. Please try again.');
  if (data?.code) return merchantErrorResponse(data.code === 'AUTH_REQUIRED' ? 403 : 409, data.code, 'This request could not be completed. Try again with a new restaurant name.');
  return NextResponse.json({ merchant: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
