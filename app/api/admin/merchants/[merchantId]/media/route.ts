/* bitesite/app/api/admin/merchants/[merchantId]/media/route.ts */

/**
 * Admin profile images (M6b): GET the current logo/cover, PUT to bind a checked upload or remove a
 * photo. The actor is the verified Admin session, recorded as `legacy_admin`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { bindMerchantMedia, readMerchantMedia } from '@/app/api/_lib/merchant-media';

type Context = { params: Promise<{ merchantId: string }> };

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
}

export async function GET(request: NextRequest, { params }: Context) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { merchantId } = await params;
  return readMerchantMedia({ type: 'admin' }, merchantId);
}

export async function PUT(request: NextRequest, { params }: Context) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { merchantId } = await params;
  return bindMerchantMedia(request, { type: 'admin' }, merchantId);
}
