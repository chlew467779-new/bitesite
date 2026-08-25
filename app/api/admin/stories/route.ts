/* bitesite/app/api/admin/stories/route.ts */


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
    // Stories 页面浏览（story_list + story）
    const { data: storyViews } = await supabase
      .from('merchant_daily_views')
      .select('page_type, slug, count')
      .in('page_type', ['story', 'story_list'])
      .gte('view_date', start)
      .lte('view_date', end);

    const storyMap = new Map<string, { slug: string; views: number }>();
    storyViews?.forEach(row => {
      const slug = row.slug || 'story-list';
      const existing = storyMap.get(slug) || { slug, views: 0 };
      existing.views += row.count || 0;
      storyMap.set(slug, existing);
    });

    // story_to_merchant 转化
    const { data: conversions } = await supabase
      .from('merchant_daily_views')
      .select('slug, count')
      .eq('event_type', 'story_to_merchant')
      .gte('view_date', start)
      .lte('view_date', end);

    const conversionMap = new Map<string, number>();
    conversions?.forEach(row => {
      const slug = row.slug || 'unknown';
      conversionMap.set(slug, (conversionMap.get(slug) || 0) + (row.count || 0));
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
