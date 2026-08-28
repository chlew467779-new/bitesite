/* bitesite/app/api/admin/locations/route.ts */

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

function normalizeCity(rawCity: string | null): string {
  if (!rawCity || rawCity === 'Unknown') return 'Unknown';
  try {
    const decoded = rawCity.includes('%') ? decodeURIComponent(rawCity) : rawCity;
    return decoded.trim();
  } catch {
    return rawCity.trim();
  }
}

function normalizeCountry(rawCountry: string | null): string {
  if (!rawCountry || rawCountry === 'Unknown') return 'Unknown';
  return rawCountry.trim();
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
      const key = normalizeCountry(row.country);
      countryMap.set(key, (countryMap.get(key) || 0) + (row.count || 0));
    });

    // 城市分布（Top 20）— 用 normalize 后的名字做 key，合并重复
    const { data: cityData } = await supabase
      .from('merchant_daily_views')
      .select('city, country, count')
      .eq('event_type', 'page_view')
      .gte('view_date', start)
      .lte('view_date', end);

    const cityMap = new Map<string, { city: string; country: string; value: number }>();
    cityData?.forEach(row => {
      const city = normalizeCity(row.city);
      const country = normalizeCountry(row.country);
      const key = `${city.toLowerCase()}|${country.toLowerCase()}`; // 小写 key 合并大小写差异
      
      const existing = cityMap.get(key);
      if (existing) {
        existing.value += row.count || 0;
      } else {
        cityMap.set(key, { city, country, value: row.count || 0 });
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
