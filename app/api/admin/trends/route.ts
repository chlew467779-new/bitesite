/* bitesite/app/api/admin/trends/route.ts */


import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { getMytDateRange } from '@/lib/myt-date';

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d';
  const { start, end } = getMytDateRange(range);
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00+08:00`);
  const endDate = new Date(`${end}T00:00:00+08:00`);
  while (cursor <= endDate) {
    dates.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const startDate = start;

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
