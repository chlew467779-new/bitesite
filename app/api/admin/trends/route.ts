/* bitesite/app/api/admin/trends/route.ts */


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getDateRange(range: string) {
  const days = range === 'today' ? 1 : parseInt(range) || 7;
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d';
  const dates = getDateRange(range);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  try {
    const { data } = await supabase
      .from('merchant_daily_views')
      .select('view_date, count')
      .eq('event_type', 'page_view')
      .gte('view_date', startDate)
      .lte('view_date', endDate);

    const trendMap = new Map<string, number>();
    dates.forEach(d => trendMap.set(d, 0));
    
    data?.forEach(row => {
      trendMap.set(row.view_date, (trendMap.get(row.view_date) || 0) + (row.count || 0));
    });

    const result = dates.map(date => ({
      date,
      views: trendMap.get(date) || 0,
    }));

    return NextResponse.json({ data: result, range });
  } catch (err) {
    console.error('Trends API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
