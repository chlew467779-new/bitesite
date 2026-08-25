/* bitesite/app/api/admin/locations/route.ts */


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
    // 国家分布
    const { data: countryData } = await supabase
      .from('merchant_daily_views')
      .select('country, count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const countryMap = new Map<string, number>();
    countryData?.forEach(row => {
      const key = row.country || 'Unknown';
      countryMap.set(key, (countryMap.get(key) || 0) + (row.count || 0));
    });

    // 城市分布（Top 20）
    const { data: cityData } = await supabase
      .from('merchant_daily_views')
      .select('city, country, count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const cityMap = new Map<string, { city: string; country: string; value: number }>();
    cityData?.forEach(row => {
      const key = `${row.city || 'Unknown'}|${row.country || 'Unknown'}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.value += row.count || 0;
      } else {
        cityMap.set(key, {
          city: row.city || 'Unknown',
          country: row.country || 'Unknown',
          value: row.count || 0,
        });
      }
    });

    const topCities = Array.from(cityMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    return NextResponse.json({
      countries: Array.from(countryMap.entries()).map(([name, value]) => ({ name, value })),
      cities: topCities,
      range,
    });
  } catch (err) {
    console.error('Locations API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
