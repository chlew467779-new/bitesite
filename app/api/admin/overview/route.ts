/* bitesite/app/api/admin/overview/route.ts */

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
    // Total Views — 保留聚合表查询（速度快）
    const { data: viewsData } = await supabase
      .from('merchant_daily_views')
      .select('count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const totalViews = viewsData?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    // FIX: Unique Visitors 直接从 page_views 查 DISTINCT ip，绕过聚合表维度拆分问题
    const startDateTime = `${start}T00:00:00+08:00`;
    const endDateTime = `${end}T23:59:59+08:00`;

    const { data: uniqueData } = await supabase
      .from('page_views')
      .select('ip')
      .eq('event_type', 'page_view')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const totalUnique = new Set(
      uniqueData?.map(r => r.ip).filter((ip): ip is string => Boolean(ip))
    ).size;

    // Total Events（非 page_view）
    const { data: eventsData } = await supabase
      .from('merchant_daily_views')
      .select('count')
      .neq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const totalEvents = eventsData?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    // Merchant count
    const { count: merchantCount } = await supabase
      .from('merchants')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    // Today views
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData } = await supabase
      .from('merchant_daily_views')
      .select('count')
      .eq('event_type', 'page_view')
      .eq('view_date', today);

    const todayViews = todayData?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    return NextResponse.json({
      totalViews,
      totalUnique,
      totalEvents,
      merchantCount: merchantCount || 0,
      todayViews,
      range,
    });
  } catch (err) {
    console.error('Overview API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
