/* bitesite/app/api/merchant/restaurants/[merchantId]/fields/route.ts */

/**
 * Owner field save (D2-A): GET the editable fields as snapshots, PATCH with field-level
 * compare-and-set. The Owner is the verified Supabase user; the database checks, under lock,
 * that this user is the restaurant's active Owner (404 otherwise) and that it is writable.
 */

import type { NextRequest } from 'next/server';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { patchMerchantFields, readMerchantFields } from '@/app/api/_lib/merchant-field-patch';

type Context = { params: Promise<{ merchantId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  return readMerchantFields({ type: 'owner', userId: auth.user.id }, merchantId);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  return patchMerchantFields(request, { type: 'owner', userId: auth.user.id }, merchantId);
}
