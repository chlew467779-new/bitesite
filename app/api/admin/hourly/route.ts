/* bitesite/app/api/admin/hourly/route.ts */

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
    // 从原始日志查小时分布（daily_views 没有小时维度）
    const { data } = await supabase
      .from('page_views')
      .select('created_at')
      .eq('event_type', 'page_view')
      .gte('created_at', `${start}T00:00:00Z`)
      .lte('created_at', `${end}T23:59:59Z`);

    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);

    data?.forEach(row => {
      const hour = new Date(row.created_at).getUTCHours() + 8; // UTC+8 Malaysia
      const adjustedHour = hour >= 24 ? hour - 24 : hour;
      hourlyMap.set(adjustedHour, (hourlyMap.get(adjustedHour) || 0) + 1);
    });

    const result = Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    return NextResponse.json({ data: result, range });
  } catch (err) {
    console.error('Hourly API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
