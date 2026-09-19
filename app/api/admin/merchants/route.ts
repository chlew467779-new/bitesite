/* bitesite/app/api/admin/merchants/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

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

    // Order clicks are aggregated by event type. Platform detail remains in
    // page_views until a second delivery platform requires a schema change.
    const { data: orderClickData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'merchant_order_click')
      .gte('view_date', start)
      .lte('view_date', end);

    const { data: directionsData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'directions_click')
      .gte('view_date', start)
      .lte('view_date', end);

    const { data: phoneData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'phone_click')
      .gte('view_date', start)
      .lte('view_date', end);

    const { data: menuData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'menu_view')
      .eq('page_type', 'merchant')
      .gte('view_date', start)
      .lte('view_date', end);

    const { data: websiteData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'website_click')
      .gte('view_date', start)
      .lte('view_date', end);

    const { data: emailData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'email_click')
      .gte('view_date', start)
      .lte('view_date', end);

    // Story slugs are stored in page_views; map them to merchants through the
    // article relation and keep the result separate from merchant page views.
    const { data: storyViewData } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'page_view')
      .eq('page_type', 'story')
      .gte('view_date', start)
      .lte('view_date', end);

    const { data: articlesWithMerchant } = await supabase
      .from('articles')
      .select('slug, merchant_slug')
      .not('merchant_slug', 'is', null);

    // Aggregated unique_ips are split by device/location dimensions and must
    // not be summed across rows. Recompute distinct visitors per merchant from
    // the server-only raw event table instead.
    const startDateTime = `${start}T00:00:00+08:00`;
    const endDateTime = `${end}T23:59:59+08:00`;
    const { data: merchantVisitorData } = await supabase
      .from('page_views')
      .select('slug, ip')
      .eq('page_type', 'merchant')
      .eq('event_type', 'page_view')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const visitorIpsByMerchant = new Map<string, Set<string>>();
    merchantVisitorData?.forEach(row => {
      if (!row.slug || !row.ip) return;
      const ips = visitorIpsByMerchant.get(row.slug) || new Set<string>();
      ips.add(row.ip);
      visitorIpsByMerchant.set(row.slug, ips);
    });

    const articleToMerchant = new Map<string, string>();
    articlesWithMerchant?.forEach(article => {
      if (article.merchant_slug) articleToMerchant.set(article.slug, article.merchant_slug);
    });
    const storyViewsByMerchant = new Map<string, number>();
    storyViewData?.forEach(row => {
      const merchantSlug = articleToMerchant.get(row.slug);
      if (merchantSlug) {
        storyViewsByMerchant.set(merchantSlug, (storyViewsByMerchant.get(merchantSlug) || 0) + (row.count || 0));
      }
    });

    // 聚合
    const merchantMap = new Map<string, {
      slug: string;
      views: number;
      unique_ips: number;
      whatsapp: number;
      bookings: number;
      grabfoodClicks: number;
      directionsClicks: number;
      phoneClicks: number;
      menuViews: number;
      websiteClicks: number;
      storyViews: number;
      emailClicks?: number;
    }>();

    viewData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug,
        views: 0,
        unique_ips: 0,
        whatsapp: 0,
        bookings: 0,
        grabfoodClicks: 0,
        directionsClicks: 0,
        phoneClicks: 0,
        menuViews: 0,
        websiteClicks: 0,
        storyViews: 0,
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
        grabfoodClicks: 0,
        directionsClicks: 0,
        phoneClicks: 0,
        menuViews: 0,
        websiteClicks: 0,
        storyViews: 0,
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
        grabfoodClicks: 0,
        directionsClicks: 0,
        phoneClicks: 0,
        menuViews: 0,
        websiteClicks: 0,
        storyViews: 0,
      };
      existing.bookings += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    orderClickData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug, views: 0, unique_ips: 0, whatsapp: 0, bookings: 0,
        grabfoodClicks: 0, directionsClicks: 0, phoneClicks: 0, menuViews: 0, websiteClicks: 0, storyViews: 0, emailClicks: 0,
      };
      existing.grabfoodClicks += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    directionsData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug, views: 0, unique_ips: 0, whatsapp: 0, bookings: 0,
        grabfoodClicks: 0, directionsClicks: 0, phoneClicks: 0, menuViews: 0, websiteClicks: 0, storyViews: 0, emailClicks: 0,
      };
      existing.directionsClicks += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    phoneData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug, views: 0, unique_ips: 0, whatsapp: 0, bookings: 0,
        grabfoodClicks: 0, directionsClicks: 0, phoneClicks: 0, menuViews: 0, websiteClicks: 0, storyViews: 0, emailClicks: 0,
      };
      existing.phoneClicks += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    menuData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug, views: 0, unique_ips: 0, whatsapp: 0, bookings: 0,
        grabfoodClicks: 0, directionsClicks: 0, phoneClicks: 0, menuViews: 0, websiteClicks: 0, storyViews: 0, emailClicks: 0,
      };
      existing.menuViews += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    websiteData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug, views: 0, unique_ips: 0, whatsapp: 0, bookings: 0,
        grabfoodClicks: 0, directionsClicks: 0, phoneClicks: 0, menuViews: 0, websiteClicks: 0, storyViews: 0, emailClicks: 0,
      };
      existing.websiteClicks += row.count || 0;
      merchantMap.set(row.slug, existing);
    });

    emailData?.forEach(row => {
      const existing = merchantMap.get(row.slug) || {
        slug: row.slug, views: 0, unique_ips: 0, whatsapp: 0, bookings: 0,
        grabfoodClicks: 0, directionsClicks: 0, phoneClicks: 0, menuViews: 0, websiteClicks: 0, storyViews: 0, emailClicks: 0,
      };
      existing.emailClicks = (existing.emailClicks || 0) + (row.count || 0);
      merchantMap.set(row.slug, existing);
    });

    storyViewsByMerchant.forEach((count, slug) => {
      const existing = merchantMap.get(slug) || {
        slug, views: 0, unique_ips: 0, whatsapp: 0, bookings: 0,
        grabfoodClicks: 0, directionsClicks: 0, phoneClicks: 0, menuViews: 0, websiteClicks: 0, storyViews: 0, emailClicks: 0,
      };
      existing.storyViews += count;
      merchantMap.set(slug, existing);
    });

    const result = Array.from(merchantMap.values())
      .map(merchant => ({
        ...merchant,
        emailClicks: merchant.emailClicks || 0,
        unique_ips: visitorIpsByMerchant.has(merchant.slug)
          ? visitorIpsByMerchant.get(merchant.slug)!.size
          : merchant.unique_ips,
      }))
      .sort((a, b) => b.views - a.views);

    return NextResponse.json(
      { data: result, range },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    console.error('Merchants API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
