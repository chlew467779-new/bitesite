/* bitesite/app/api/admin/realtime/route.ts */


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 最近 5 分钟内独立 IP
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('page_views')
      .select('ip', { count: 'exact', head: false })
      .gt('created_at', fiveMinutesAgo);

    if (error) throw error;

    // 用 Set 去重 IP（Supabase 不支持 DISTINCT in select）
    const uniqueIPs = new Set(data?.map(r => r.ip) || []);
    const onlineCount = uniqueIPs.size;

    return NextResponse.json({
      onlineCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Realtime API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
