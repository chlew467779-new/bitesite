/* bitesite/app/api/admin/export/route.ts */

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
  const format = searchParams.get('format') || 'csv';
  const { start, end } = getDateRange(range);

  try {
    // 查询每日商家汇总
    const { data } = await supabase
      .from('merchant_daily_views')
      .select('slug, page_type, view_date, device_type, country, city, event_type, count, unique_ips')
      .gte('view_date', start)
      .lte('view_date', end)
      .order('view_date', { ascending: false })
      .order('count', { ascending: false });

    if (format === 'csv') {
      const headers = ['Date', 'Slug', 'Page Type', 'Device', 'Country', 'City', 'Event Type', 'Count', 'Unique IPs'];
      const rows = data?.map(row => [
        row.view_date,
        row.slug || '-',
        row.page_type,
        row.device_type || '-',
        row.country || '-',
        row.city || '-',
        row.event_type,
        row.count,
        row.unique_ips,
      ]) || [];

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="bitesite-analytics-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ data, range });
  } catch (err) {
    console.error('Export API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
