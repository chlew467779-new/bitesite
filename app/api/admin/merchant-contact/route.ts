/* bitesite/app/api/admin/merchant-contact/route.ts */

/**
 * Who to tell about an Admin decision (CH 2026-09-30): GET ?merchantId= → the restaurant's name,
 * page address, WhatsApp and phone, and the active Owner's login email. Used by the one-tap
 * WhatsApp / email notice after Approve or Reject; nothing is sent from here.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });
  const merchantId = new URL(request.url).searchParams.get('merchantId') ?? '';
  if (!UUID.test(merchantId)) return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Invalid restaurant.' } }, { status: 400 });

  const [merchant, owner] = await Promise.all([
    supabase.from('merchants').select('name, slug, is_published, whatsapp, phone').eq('id', merchantId).maybeSingle(),
    supabase.from('merchant_memberships').select('user_id').eq('merchant_id', merchantId).eq('role', 'owner').eq('status', 'active').limit(1).maybeSingle(),
  ]);
  if (merchant.error || !merchant.data) return NextResponse.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Restaurant not found.' } }, { status: 404 });
  let ownerEmail: string | null = null;
  if (owner.data?.user_id) {
    const { data } = await supabase.auth.admin.getUserById(owner.data.user_id);
    ownerEmail = data?.user?.email ?? null;
  }
  const m = merchant.data;
  return NextResponse.json({
    data: { name: m.name, slug: m.is_published ? m.slug : null, whatsapp: m.whatsapp, phone: m.phone, ownerEmail },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
