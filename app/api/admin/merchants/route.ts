/* bitesite/app/api/admin/merchants/route.ts */


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
    // 查询商家访问数据
    const { data: viewData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count, unique_ips')
      .eq('event_type', 'page_view')
      .eq('page_type', 'merchant')
      .gte('view_date', start)
      .lte('view_date', end);

    // 查询 WhatsApp 点击
    const { data: waData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'whatsapp_click')
      .gte('view_date', start)
      .lte('view_date', end);

    // 查询 Booking 提交
    const { data: bookData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'booking_submit')
      .gte('view_date', start)
      .lte('view_date', end);

    // 聚合
    const merchantMap = new Map<string, {
      slug: string;
      views: number;
      unique_ips: number;
      whatsapp: number;
      bookings: number;
    }>();

    viewData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug,
        views: 0,
        unique_ips: 0,
        whatsapp: 0,
        bookings: 0,
      };
      existing.views += row.count || 0;
      existing.unique_ips += row.unique_ips || 0;
      merchantMap.set(row.slug, existing);
    });

    waData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug,
        views: 0,
        unique_ips: 0,
        whatsapp: 0,
        bookings: 0,
      };
      existing.whatsapp += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    bookData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug,
        views: 0,
        unique_ips: 0,
        whatsapp: 0,
        bookings: 0,
      };
      existing.bookings += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    const result = Array.from(merchantMap.values())
      .sort((a, b) => b.views - a.views);

    return NextResponse.json({ data: result, range });
  } catch (err) {
    console.error('Merchants API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
