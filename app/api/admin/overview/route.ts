/* bitesite/app/api/admin/overview/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

function getDateRange(range: string) {
  const end = new Date();
  const start = new Date();
  
  switch (range) {
    case 'today': start.setHours(0,0,0,0); break;
    case '7d': start.setDate(end.getDate() - 6); break;
    case '30d': start.setDate(end.getDate() - 29); break;
    case '90d': start.setDate(end.getDate() - 89); break;
    case '365d': start.setDate(end.getDate() - 364); break;
    default: start.setDate(end.getDate() - 6);
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
    // FIX: Unique Visitors 直接从 page_views 查 DISTINCT ip，绕过聚合表维度拆分问题
    const startDateTime = `${start}T00:00:00+08:00`;
    const endDateTime = `${end}T23:59:59+08:00`;

    const [
      { data: viewsData },
      { data: uniqueData },
      { data: eventsData },
      { count: merchantCount },
      { data: todayData },
    ] = await Promise.all([
      supabase.from('merchant_daily_views').select('count').eq('event_type', 'page_view').gte('view_date', start).lte('view_date', end),
      supabase.from('page_views').select('ip').eq('event_type', 'page_view').gte('created_at', startDateTime).lte('created_at', endDateTime),
      supabase.from('merchant_daily_views').select('count').neq('event_type', 'page_view').gte('view_date', start).lte('view_date', end),
      supabase.from('merchants').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('merchant_daily_views').select('count').eq('event_type', 'page_view').eq('view_date', new Date().toISOString().split('T')[0]),
    ]);

    const totalViews = viewsData?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    const totalUnique = new Set(
      uniqueData?.map(r => r.ip).filter((ip): ip is string => Boolean(ip))
    ).size;

    const totalEvents = eventsData?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    const todayViews = todayData?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    return NextResponse.json({
      totalViews,
      totalUnique,
      totalEvents,
      merchantCount: merchantCount || 0,
      todayViews,
      range,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('Overview API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
