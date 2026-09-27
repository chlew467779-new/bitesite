/* bitesite/app/api/admin/merchants/[merchantId]/fields/route.ts */

/**
 * Admin field save (D2-A): the same compare-and-set contract as the Owner endpoint. The actor is
 * the verified Admin session (x-admin-token), recorded as the fixed principal `legacy_admin`.
 * Admin may also set the registered feature keys; links stay closed here as for Owners.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { patchMerchantFields, readMerchantFields } from '@/app/api/_lib/merchant-field-patch';

type Context = { params: Promise<{ merchantId: string }> };

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
}

export async function GET(request: NextRequest, { params }: Context) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { merchantId } = await params;
  return readMerchantFields({ type: 'admin' }, merchantId);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { merchantId } = await params;
  return patchMerchantFields(request, { type: 'admin' }, merchantId);
}
