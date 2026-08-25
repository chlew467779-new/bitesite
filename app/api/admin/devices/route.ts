/* bitesite/app/api/admin/devices/route.ts */


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
    // 设备分布
    const { data: deviceData } = await supabase
      .from('merchant_daily_views')
      .select('device_type, count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const deviceMap = new Map<string, number>();
    deviceData?.forEach(row => {
      const key = row.device_type || 'unknown';
      deviceMap.set(key, (deviceMap.get(key) || 0) + (row.count || 0));
    });

    // OS 分布
    const { data: osData } = await supabase
      .from('merchant_daily_views')
      .select('os, count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const osMap = new Map<string, number>();
    osData?.forEach(row => {
      const key = row.os || 'unknown';
      osMap.set(key, (osMap.get(key) || 0) + (row.count || 0));
    });

    // Browser 分布
    const { data: browserData } = await supabase
      .from('merchant_daily_views')
      .select('browser, count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const browserMap = new Map<string, number>();
    browserData?.forEach(row => {
      const key = row.browser || 'unknown';
      browserMap.set(key, (browserMap.get(key) || 0) + (row.count || 0));
    });

    return NextResponse.json({
      devices: Array.from(deviceMap.entries()).map(([name, value]) => ({ name, value })),
      os: Array.from(osMap.entries()).map(([name, value]) => ({ name, value })),
      browsers: Array.from(browserMap.entries()).map(([name, value]) => ({ name, value })),
      range,
    });
  } catch (err) {
    console.error('Devices API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
