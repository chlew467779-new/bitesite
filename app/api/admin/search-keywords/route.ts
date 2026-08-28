/* bitesite/app/api/admin/search-keywords/route.ts */

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
    // 从原始日志查搜索关键词（因为 daily_views 没有 event_detail）
    const { data } = await supabase
      .from('page_views')
      .select('event_detail')
      .eq('event_type', 'search')
      .gte('created_at', `${start}T00:00:00Z`)
      .lte('created_at', `${end}T23:59:59Z`);

    const keywordMap = new Map<string, number>();
    data?.forEach(row => {
      const keyword = row.event_detail?.trim().toLowerCase();
      if (keyword) {
        keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
      }
    });

    const result = Array.from(keywordMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return NextResponse.json({ data: result, range });
  } catch (err) {
    console.error('Search keywords API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
