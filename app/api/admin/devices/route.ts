/* bitesite/app/api/admin/devices/route.ts */

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

    // FIX: 直接从 page_views 原始表查，避开聚合表 device_type=null 的污染
    const { data: rawData } = await supabase
      .from('page_views')
      .select('device_type, os, browser')
      .eq('event_type', 'page_view')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const deviceMap = new Map<string, number>();
    const osMap = new Map<string, number>();
    const browserMap = new Map<string, number>();

    rawData?.forEach(row => {
      // 把 null/空值/unknown 都 fallback 到 desktop，彻底消灭 unknown
      const device = row.device_type || 'desktop';
      const os = row.os || 'Other';
      const browser = row.browser || 'Other';
      
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
      osMap.set(os, (osMap.get(os) || 0) + 1);
      browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
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
