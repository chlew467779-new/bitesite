/* bitesite/app/api/admin/merchants/[merchantId]/media/ticket/route.ts */

/** Admin profile image upload ticket (M6b): a signed upload URL for a server-chosen path. */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createMediaTicket } from '@/app/api/_lib/merchant-media';

type Context = { params: Promise<{ merchantId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
  const { merchantId } = await params;
  return createMediaTicket(request, { type: 'admin' }, merchantId);
}
