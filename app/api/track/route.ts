/* bitesite/app/api/track/route.ts */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { detectDevice } from '@/lib/device-detect';
import { classifyReferrer, EventTypes } from '@/lib/analytics';
import { allowAnalyticsRequest, getClientIp, isDuplicateAnalyticsEvent } from '@/lib/analytics-rate-limit';

const ALLOWED_EVENT_TYPES = new Set<string>(Object.values(EventTypes));
const ALLOWED_PAGE_TYPES = new Set([
  'home',
  'merchant',
  'story',
  'story_list',
  'join_us',
  'our_partner',
  'other',
]);
const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Invalid string field');
  return value.trim().slice(0, maxLength);
}

function normalizeCity(rawCity: string): string {
  if (!rawCity || rawCity === 'Unknown') return 'Unknown';
  try {
    const decoded = rawCity.includes('%') ? decodeURIComponent(rawCity) : rawCity;
    return decoded.trim();
  } catch {
    return rawCity.trim();
  }
}

function normalizeCountry(rawCountry: string): string {
  if (!rawCountry || rawCountry === 'Unknown') return 'Unknown';
  return rawCountry.trim().toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }
    const requestIp = getClientIp(request);
    if (!allowAnalyticsRequest(`track:${requestIp}`)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    // FIX: 兼容 sendBeacon 发送的 Blob 和 fetch 发送的 JSON
    let body;
    try {
      body = await request.json();
    } catch {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const eventType = optionalString(body.eventType, 64) || 'page_view';
    const slug = optionalString(body.slug, 200);
    const path = optionalString(body.path, 512) || '/';
    const pageType = optionalString(body.pageType, 64) || 'other';
    const eventDetail = optionalString(body.eventDetail, 500);
    const referrer = optionalString(body.referrer, 2048) || '';

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 });
    }
    if (!ALLOWED_PAGE_TYPES.has(pageType)) {
      return NextResponse.json({ error: 'Unsupported page type' }, { status: 400 });
    }
    if (slug && !SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }
    if (!path.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Page and menu exposures are noisy under reloads and React development
    // remounts. Suppress only these passive events; real user actions remain
    // countable even when repeated.
    if ((eventType === EventTypes.PAGE_VIEW || eventType === EventTypes.MENU_VIEW)
      && isDuplicateAnalyticsEvent(`${requestIp}:${eventType}:${pageType}:${slug || path}`)) {
      return NextResponse.json({ success: true, deduplicated: true }, { status: 202 });
    }

    // Do not let the public ingest endpoint create analytics for arbitrary
    // slugs. Story-to-merchant events carry the Story slug in eventDetail and
    // the destination merchant slug in slug, so validate both sides.
    if (pageType === 'merchant' && slug) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('slug')
        .eq('slug', slug)
        .maybeSingle();
      if (!merchant) {
        return NextResponse.json({ error: 'Unknown merchant' }, { status: 400 });
      }
    }

    if (pageType === 'story' && eventType === 'page_view' && slug) {
      const { data: article } = await supabase
        .from('articles')
        .select('slug')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (!article) {
        return NextResponse.json({ error: 'Unknown story' }, { status: 400 });
      }
    }

    if (eventType === EventTypes.STORY_TO_MERCHANT && slug && eventDetail) {
      const [{ data: merchant }, { data: article }] = await Promise.all([
        supabase.from('merchants').select('slug').eq('slug', slug).maybeSingle(),
        supabase.from('articles').select('slug').eq('slug', eventDetail).eq('published', true).maybeSingle(),
      ]);
      if (!merchant || !article) {
        return NextResponse.json({ error: 'Invalid story destination' }, { status: 400 });
      }
    }

    // 获取 IP 和地理位置（Vercel headers）
    const ip = requestIp;
    const rawCountry = request.headers.get('x-vercel-ip-country') || 'Unknown';
    const rawCity = request.headers.get('x-vercel-ip-city') || 'Unknown';
    
    const country = normalizeCountry(rawCountry);
    const city = normalizeCity(rawCity);

    // 设备检测
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 512);
    const { device, os, browser } = detectDevice(userAgent);
    const referrerType = classifyReferrer(referrer);

    // 插入原始日志
    const { error } = await supabase.from('page_views').insert({
      slug,
      path,
      page_type: pageType,
      event_type: eventType,
      event_detail: eventDetail,
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
