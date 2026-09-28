/* bitesite/app/api/merchant/restaurants/[merchantId]/media/ticket/route.ts */

/** Owner profile image upload ticket (M6b): a signed upload URL for a server-chosen path. */

import type { NextRequest } from 'next/server';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { createMediaTicket } from '@/app/api/_lib/merchant-media';

type Context = { params: Promise<{ merchantId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  return createMediaTicket(request, { type: 'owner', userId: auth.user.id }, merchantId);
}
