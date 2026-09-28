/* bitesite/app/api/merchant/restaurants/[merchantId]/media/route.ts */

/**
 * Owner profile images (M6b): GET the current logo/cover, PUT to bind a checked upload or remove a
 * photo. The Owner is the verified Supabase user; the database checks, under lock, that this user
 * is the restaurant's active Owner (404 otherwise) and that the restaurant is writable.
 */

import type { NextRequest } from 'next/server';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { bindMerchantMedia, readMerchantMedia } from '@/app/api/_lib/merchant-media';

type Context = { params: Promise<{ merchantId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  return readMerchantMedia({ type: 'owner', userId: auth.user.id }, merchantId);
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  return bindMerchantMedia(request, { type: 'owner', userId: auth.user.id }, merchantId);
}
