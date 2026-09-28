import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { PROFILE_TEXT_FIELDS } from '@/lib/merchant-profile-validation.mjs';
import { resolveMerchantAccess } from '@/lib/merchant-access-core.mjs';
import {
  loadOwnedMerchants,
  merchantErrorResponse,
  ownedMerchantSummaries,
  requestedMerchantId,
  requireMerchantAccess,
  requireMerchantUser,
} from '@/app/api/merchant/_lib/merchant-access';

const editableTextFields = PROFILE_TEXT_FIELDS;
// The Owner's private view of one merchant: an explicit column list, not the whole row.
const PROFILE_COLUMNS = ['id', 'name', 'slug', 'address', 'business_status', 'platform_status', ...editableTextFields, 'operating_hours'].join(', ');

/**
 * Account bootstrap: the verified account, a summary of every restaurant it owns, and the private
 * profile of the selected one. The selection is `?merchantId=`; without it, only an account with
 * exactly one restaurant gets a profile (none or several: `merchant: null`, the page asks).
 */
export async function GET(request: NextRequest) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const owned = await loadOwnedMerchants(auth.user.id);
  if ('response' in owned) return owned.response;

  const account = { id: auth.user.id, email: auth.user.email ?? null };
  const merchants = ownedMerchantSummaries(owned.merchants);
  const requested = requestedMerchantId(request);
  if (requested === undefined && owned.merchants.length !== 1) return NextResponse.json({ account, merchants, merchant: null });

  const access = resolveMerchantAccess({ merchants: owned.merchants, requestedMerchantId: requested, capability: 'read' });
  if (!access.ok) return merchantErrorResponse(access.status, access.code, access.message);
  const { data, error } = await supabase.from('merchants').select(PROFILE_COLUMNS).eq('id', access.merchant.id).maybeSingle();
  if (error) return merchantErrorResponse(500, 'INTERNAL_ERROR', 'We could not load this restaurant. Please try again.');
  if (!data) return merchantErrorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  return NextResponse.json({ account, merchants, merchant: { ...(data as unknown as Record<string, unknown>), restriction: access.restriction } });
}

/**
 * Retired (D2-B write cutover). The old whole-form save had no baseline, so it could overwrite
 * another session's change. Profile fields are saved section by section through
 * PATCH /api/merchant/restaurants/[merchantId]/fields. The caller is still authenticated and
 * scoped first, so the reply reveals nothing about other restaurants; no write happens.
 */
export async function PUT(request: NextRequest) {
  const access = await requireMerchantAccess(request, 'read');
  if ('response' in access) return access.response;
  return merchantErrorResponse(410, 'LEGACY_WRITE_RETIRED', 'This page was updated. Reload it to keep editing; copy any unsaved text first.');
}
