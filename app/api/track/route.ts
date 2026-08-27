/* bitesite/app/api/track/route.ts */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectDevice } from '@/lib/device-detect';
import { classifyReferrer } from '@/lib/analytics';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventType,
      slug,
      path,
      pageType,
      eventDetail,
      referrer,
    } = body;

    // 获取 IP 和地理位置（Vercel headers）
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const country = request.headers.get('x-vercel-ip-country') || 'Unknown';
    const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

    // 设备检测
    const userAgent = request.headers.get('user-agent') || '';
    const { device, os, browser } = detectDevice(userAgent);
    const referrerType = classifyReferrer(referrer);

    // 插入原始日志
    const { error } = await supabase.from('page_views').insert({
      slug: slug || null,
      path: path || '/',
      page_type: pageType || 'other',
      event_type: eventType || 'page_view',
      event_detail: eventDetail || null,
      ip,
      country,
      city,
      device_type: device,
      os,
      browser,
      user_agent: userAgent,
      referrer: referrer || null,
      referrer_type: referrerType,
    });

    if (error) {
      console.error('Track error:', error);
      return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Track API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
