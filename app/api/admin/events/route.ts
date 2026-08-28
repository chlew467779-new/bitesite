/* bitesite/app/api/admin/events/route.ts */

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

    // FIX: 从 page_views 原始表实时查询（不需要等聚合）
    const { data: rawData } = await supabase
      .from('page_views')
      .select('event_type, created_at')
      .neq('event_type', 'page_view')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    // 汇总统计
    const eventMap = new Map<string, number>();
    const dailyMap = new Map<string, Map<string, number>>();
    const eventTypes = ['whatsapp_click', 'booking_submit', 'share', 'search', 'map_marker_click', 'story_to_merchant'];

    rawData?.forEach(row => {
      const type = row.event_type || 'other';
      const date = row.created_at ? row.created_at.split('T')[0] : '';
      
      // Summary
      eventMap.set(type, (eventMap.get(type) || 0) + 1);
      
      // Daily trend
      if (date) {
        if (!dailyMap.has(date)) dailyMap.set(date, new Map());
        const typeMap = dailyMap.get(date)!;
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
      }
    });

    const dates = Array.from(dailyMap.keys()).sort();
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
