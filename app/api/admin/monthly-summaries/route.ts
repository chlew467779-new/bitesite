/* bitesite/app/api/admin/monthly-summaries/route.ts */

/**
 * Admin monthly summaries (CH 2026-09-30): GET → every live restaurant's numbers for last month
 * and the month before, for the one-tap WhatsApp summary. "Live" is decided by row level security
 * (the public client sees only public restaurants). Nothing is sent from here.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabase as publicClient } from '@/lib/supabase';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { dailyRows, slugOwners } from '@/app/api/_lib/monthly-summary';
import { summaryRanges, summaryTotals } from '@/lib/monthly-summary-core.mjs';

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });

  try {
    const { data: live, error: liveError } = await publicClient.from('merchants').select('id, name, slug').order('name');
    if (liveError) throw new Error(`live restaurants: ${liveError.message}`);
    const merchants = (live ?? []) as { id: string; name: string; slug: string }[];
    const ids = merchants.map((m) => m.id);
    const { data: contacts, error: contactError } = ids.length
      ? await supabase.from('merchants').select('id, whatsapp, phone').in('id', ids)
      : { data: [], error: null };
    if (contactError) throw new Error(`contacts: ${contactError.message}`);
    const reachable = new Map((contacts ?? []).map((c) => [c.id as string, Boolean(c.whatsapp || c.phone)]));

    const ranges = summaryRanges();
    const owners = await slugOwners(merchants);
    const rows = await dailyRows([...owners.keys()], ranges.monthBefore.from, ranges.lastMonth.to);
    const byMerchant = new Map<string, typeof rows>();
    for (const row of rows) {
      const id = owners.get(row.slug);
      if (!id) continue;
      const list = byMerchant.get(id) ?? [];
      list.push(row);
      byMerchant.set(id, list);
    }
    const items = merchants.map((m) => ({
      merchantId: m.id,
      name: m.name,
      slug: m.slug,
      hasPhone: reachable.get(m.id) ?? false,
      lastMonth: summaryTotals(byMerchant.get(m.id), ranges.lastMonth),
      monthBefore: summaryTotals(byMerchant.get(m.id), ranges.monthBefore),
    }));
    return NextResponse.json({ data: { lastMonth: ranges.lastMonth, monthBefore: ranges.monthBefore, items } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Admin monthly summaries failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load the summaries.' } }, { status: 500 });
  }
}
