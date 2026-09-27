/* bitesite/app/api/merchant/preview/route.ts */

/**
 * Owner private preview: GET `?merchantId=` returns what the restaurant page would show, even while
 * it is a draft, waiting for review, approved but hidden, or suspended. Only the restaurant's
 * active Owner gets it (shared access helper); the data is the public projection (see
 * app/api/_lib/merchant-preview.ts).
 */

import type { NextRequest } from 'next/server';
import { requireMerchantAccess } from '@/app/api/merchant/_lib/merchant-access';
import { merchantPreviewResponse } from '@/app/api/_lib/merchant-preview';

export async function GET(request: NextRequest) {
  const access = await requireMerchantAccess(request, 'read');
  if ('response' in access) return access.response;
  return merchantPreviewResponse(access.merchant.id);
}
