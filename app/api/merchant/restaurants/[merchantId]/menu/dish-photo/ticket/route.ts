/* bitesite/app/api/merchant/restaurants/[merchantId]/menu/dish-photo/ticket/route.ts */

/** Owner dish photo upload ticket: a signed upload URL for a server-chosen path of this dish. */

import type { NextRequest } from 'next/server';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { createDishTicket } from '@/app/api/_lib/merchant-media';

type Context = { params: Promise<{ merchantId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  return createDishTicket(request, { type: 'owner', userId: auth.user.id }, merchantId);
}
