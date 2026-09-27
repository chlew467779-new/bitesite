/* bitesite/app/api/merchant/restaurants/[merchantId]/stats/route.ts */

/**
 * Owner statistics: GET `?days=7|30|90` — page views, unique visitors, actions (menu, WhatsApp,
 * call, directions, ...) and a daily page-view series for this restaurant, including its former
 * web addresses. Aggregates only; the database checks the active Owner.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { mapFieldRpcError } from '@/lib/merchant-field-patch-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };
const ALLOWED_DAYS = new Set([7, 30, 90]);

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return NextResponse.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Restaurant not found.' } }, { status: 404 });
  const days = Number(request.nextUrl.searchParams.get('days') ?? '30');
  if (!ALLOWED_DAYS.has(days)) return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Choose 7, 30 or 90 days.' } }, { status: 400 });
  const { data, error } = await supabase.rpc('merchant_stats_read', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId, p_days: days });
  if (error) {
    const mapped = mapFieldRpcError(error);
    if (mapped.status === 500) console.error('merchant_stats_read failed:', error.message);
    return NextResponse.json({ error: { code: mapped.code, message: mapped.message } }, { status: mapped.status });
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}
