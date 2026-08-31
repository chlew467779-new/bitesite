/* bitesite/app/api/admin/stories-analytics/route.ts */

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

    // 1. Get all published articles (slug, title, total view_count)
    const { data: articles } = await supabase
      .from('articles')
      .select('slug, title, view_count')
      .eq('published', true);

    const articleMap = new Map(articles?.map(a => [a.slug, a]) || []);

    // 2. Get period views from page_views (aggregated by slug)
    const { data: storyViews } = await supabase
      .from('page_views')
      .select('slug')
      .in('page_type', ['story', 'story_list'])
      .eq('event_type', 'page_view')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const periodViewsMap = new Map<string, number>();
    storyViews?.forEach(row => {
      const slug = row.slug || 'story-list';
      periodViewsMap.set(slug, (periodViewsMap.get(slug) || 0) + 1);
    });

    // 3. Get conversions (story_to_merchant events)
    // For story_to_merchant, event_detail should be the article slug.
    // Fallback to the 'slug' field if event_detail is empty (legacy data).
    const { data: conversions } = await supabase
      .from('page_views')
      .select('event_detail, slug')
      .eq('event_type', 'story_to_merchant')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    const conversionMap = new Map<string, number>();
    conversions?.forEach(row => {
      const articleSlug = row.event_detail || row.slug || 'unknown';
      conversionMap.set(articleSlug, (conversionMap.get(articleSlug) || 0) + 1);
    });

    // 4. Merge data: include articles with views OR conversions in period
    const allSlugs = new Set([
      ...(articles?.map(a => a.slug) || []),
      ...periodViewsMap.keys(),
      ...conversionMap.keys(),
    ]);

    const result = Array.from(allSlugs).map(slug => {
      const article = articleMap.get(slug);
      const periodViews = periodViewsMap.get(slug) || 0;
      const totalViews = article?.view_count || 0;
      const conv = conversionMap.get(slug) || 0;

      return {
        slug,
        title: article?.title || (slug === 'story-list' ? 'Stories List Page' : slug.replace(/-/g, ' ')),
        periodViews,
        totalViews,
        conversions: conv,
        conversionRate: periodViews > 0 ? ((conv / periodViews) * 100).toFixed(2) : '0.00',
      };
    }).sort((a, b) => b.periodViews - a.periodViews);

    return NextResponse.json({
      data: result,
      totalStoryViews: result.reduce((sum, r) => sum + r.periodViews, 0),
      totalAllTimeViews: result.reduce((sum, r) => sum + r.totalViews, 0),
      totalConversions: result.reduce((sum, r) => sum + r.conversions, 0),
      range,
    });
  } catch (err) {
    console.error('Stories Analytics API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
