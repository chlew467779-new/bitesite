/* bitesite/app/api/admin/map/route.ts */


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
    // 地图页总浏览
    const { data: pageViews } = await supabase
      .from('merchant_daily_views')
      .select('count')
      .eq('page_type', 'our_partner')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const totalViews = pageViews?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    // Marker 点击
    const { data: markerClicks } = await supabase
      .from('merchant_daily_views')
      .select('count')
      .eq('event_type', 'map_marker_click')
      .gte('view_date', start)
      .lte('view_date', end);

    const totalMarkers = markerClicks?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    return NextResponse.json({
      totalViews,
      totalMarkers,
      range,
    });
  } catch (err) {
    console.error('Map API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
