/* bitesite/app/api/admin/stories/route.ts */

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

    // FIX: 从 page_views 原始表实时查询 story 页面浏览
    const { data: storyViews } = await supabase
      .from('page_views')
      .select('slug, page_type')
      .in('page_type', ['story', 'story_list'])
      .eq('event_type', 'page_view')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const storyMap = new Map<string, { slug: string; views: number }>();
    storyViews?.forEach(row => {
      const slug = row.slug || 'story-list';
      const existing = storyMap.get(slug) || { slug, views: 0 };
      existing.views += 1;
      storyMap.set(slug, existing);
    });

    // FIX: 从 page_views 原始表实时查询 story_to_merchant 转化
    // event_detail 存储的是文章 slug，用于匹配 story views 的 slug
    const { data: conversions } = await supabase
      .from('page_views')
      .select('event_detail')
      .eq('event_type', 'story_to_merchant')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const conversionMap = new Map<string, number>();
    conversions?.forEach(row => {
      const articleSlug = row.event_detail || 'unknown';
      conversionMap.set(articleSlug, (conversionMap.get(articleSlug) || 0) + 1);
    });

    const result = Array.from(storyMap.values())
      .map(s => ({
        ...s,
        conversions: conversionMap.get(s.slug) || 0,
        conversionRate: s.views > 0 ? ((conversionMap.get(s.slug) || 0) / s.views * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.views - a.views);

    return NextResponse.json({
      data: result,
      totalStoryViews: result.reduce((sum, r) => sum + r.views, 0),
      totalConversions: result.reduce((sum, r) => sum + r.conversions, 0),
      range,
    });
  } catch (err) {
    console.error('Stories API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
