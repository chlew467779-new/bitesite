/* bitesite/app/api/admin/events/route.ts */


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
    // 按 event_type 汇总（排除 page_view）
    const { data } = await supabase
      .from('merchant_daily_views')
      .select('event_type, count')
      .neq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const eventMap = new Map<string, number>();
    data?.forEach(row => {
      const key = row.event_type || 'other';
      eventMap.set(key, (eventMap.get(key) || 0) + (row.count || 0));
    });

    // 按天汇总趋势
    const { data: dailyData } = await supabase
      .from('merchant_daily_views')
      .select('view_date, event_type, count')
      .neq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const dailyMap = new Map<string, Map<string, number>>();
    dailyData?.forEach(row => {
      const date = row.view_date;
      const type = row.event_type;
      if (!dailyMap.has(date)) dailyMap.set(date, new Map());
      const typeMap = dailyMap.get(date)!;
      typeMap.set(type, (typeMap.get(type) || 0) + (row.count || 0));
    });

    const dates = Array.from(dailyMap.keys()).sort();
    const eventTypes = ['whatsapp_click', 'booking_submit', 'share', 'search', 'map_marker_click', 'story_to_merchant'];
    const dailyTrend = dates.map(date => {
      const typeMap = dailyMap.get(date)!;
      return {
        date,
        ...Object.fromEntries(eventTypes.map(t => [t, typeMap.get(t) || 0])),
      };
    });

    const result = Array.from(eventMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      summary: result,
      daily: dailyTrend,
      range,
    });
  } catch (err) {
    console.error('Events API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
