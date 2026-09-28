/* bitesite/app/api/admin/merchants/[merchantId]/preview/route.ts */

/**
 * Admin preview of any restaurant page (for example before approving a review): the same data as
 * the Owner preview, public projection only. Admin session required.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { merchantPreviewResponse } from '@/app/api/_lib/merchant-preview';

type Context = { params: Promise<{ merchantId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return NextResponse.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Restaurant not found.' } }, { status: 404 });
  return merchantPreviewResponse(merchantId);
}
