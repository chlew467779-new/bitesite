/* bitesite/app/api/admin/referrers/route.ts */


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getDateRange(range: string) {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date();
  
  switch (range) {
    case 'today': start.setHours(0,0,0,0); break;
    case '7d': start.setDate(start.getDate() - 7); break;
    case '30d': start.setDate(start.getDate() - 30); break;
    case '90d': start.setDate(start.getDate() - 90); break;
    case '365d': start.setDate(start.getDate() - 365); break;
    default: start.setDate(start.getDate() - 7);
  }
  
  return { start: start.toISOString().split('T')[0], end };
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
    const { data } = await supabase
      .from('merchant_daily_views')
      .select('referrer_type, count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const referrerMap = new Map<string, number>();
    data?.forEach(row => {
      const key = row.referrer_type || 'other';
      referrerMap.set(key, (referrerMap.get(key) || 0) + (row.count || 0));
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
