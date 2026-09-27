/* bitesite/app/api/merchant/restaurants/[merchantId]/menu/dish-photo/route.ts */

/**
 * Owner dish photo: PUT `{ requestId, productId, uploadId | null, expected }` binds a checked
 * upload to the dish (or removes the photo) under compare-and-set. The database rechecks the
 * Owner, the dish and the ticket under lock.
 */

import type { NextRequest } from 'next/server';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { bindDishMedia } from '@/app/api/_lib/merchant-media';

type Context = { params: Promise<{ merchantId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  return bindDishMedia(request, { type: 'owner', userId: auth.user.id }, merchantId);
}
