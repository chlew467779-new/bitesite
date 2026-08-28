/* bitesite/app/api/admin/referrers/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getDateRange(range: string) {
  const end = new Date();
  const start = new Date();
  
  switch (range) {
    case 'today': start.setHours(0,0,0,0); break;
    case '7d': start.setDate(end.getDate() - 7); break;
    case '30d': start.setDate(end.getDate() - 30); break;
    case '90d': start.setDate(end.getDate() - 90); break;
    case '365d': start.setDate(end.getDate() - 365); break;
    default: start.setDate(end.getDate() - 7);
  }
  
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d';
  const { start, end } = getDateRange(range);

  try {
    const startDateTime = `${start}T00:00:00+08:00`;
    const endDateTime = `${end}T23:59:59+08:00`;

    // FIX: 从 page_views 原始表查，null/空 referrer 显示为 direct 而不是 other
    const { data } = await supabase
      .from('page_views')
      .select('referrer_type')
      .eq('event_type', 'page_view')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const referrerMap = new Map<string, number>();
    data?.forEach(row => {
      // 关键修复：null/空值 fallback 到 direct，不是 other
      const key = row.referrer_type || 'direct';
      referrerMap.set(key, (referrerMap.get(key) || 0) + 1);
    });

    const result = Array.from(referrerMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({ data: result, range });
  } catch (err) {
    console.error('Referrers API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
