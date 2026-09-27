/* bitesite/app/api/merchant/preview/route.ts */

/**
 * Owner private preview: GET `?merchantId=` returns what the restaurant page would show, even while
 * it is a draft, waiting for review, approved but hidden, or suspended. Only the restaurant's
 * active Owner gets it (shared access helper). The merchant row uses the public projection
 * (PUBLIC_MERCHANT_SELECT, no legacy reviews), so the preview never shows more than the public
 * page would. Never cached.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requireMerchantAccess } from '@/app/api/merchant/_lib/merchant-access';
import { PUBLIC_MERCHANT_SELECT } from '@/lib/public-merchant-projection.mjs';
import { getSettings } from '@/lib/settings';

// The columns the public page reads (explicit lists; no whole-row reads in merchant routes).
const CATEGORY_COLUMNS = 'id, merchant_id, name, sort_order, created_at';
const PRODUCT_COLUMNS = 'id, merchant_id, category_id, name, description, price, discount_price, image_url, is_featured, is_available, show_prices, sort_order, created_at';
const VIDEO_COLUMNS = 'id, merchant_id, video_url, video_type, caption, sort_order, created_at';
const EVENT_COLUMNS = 'id, merchant_id, title, description, date, time, location, image_url, created_at';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const access = await requireMerchantAccess(request, 'read');
  if ('response' in access) return access.response;
  const id = access.merchant.id;

  const [merchant, state, categories, products, videos, events, settings] = await Promise.all([
    supabase.from('merchants').select(PUBLIC_MERCHANT_SELECT).eq('id', id).maybeSingle(),
    supabase.from('merchants').select('state_source, review_status, listing_visibility, platform_restriction, business_status, is_published, platform_status').eq('id', id).maybeSingle(),
    supabase.from('categories').select(CATEGORY_COLUMNS).eq('merchant_id', id).order('sort_order', { ascending: true }),
    supabase.from('products').select(PRODUCT_COLUMNS).eq('merchant_id', id).order('sort_order', { ascending: true }),
    supabase.from('merchant_videos').select(VIDEO_COLUMNS).eq('merchant_id', id).order('sort_order', { ascending: true }),
    supabase.from('events').select(EVENT_COLUMNS).eq('merchant_id', id).order('date', { ascending: true }),
    getSettings(),
  ]);
  const failed = [merchant, state, categories, products, videos, events].find((r) => r.error);
  if (failed?.error || !merchant.data || !state.data) {
    if (failed?.error) console.error('merchant preview read failed:', failed.error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'The preview could not be loaded.' } }, { status: 500, headers: noStore });
  }

  const s = state.data as { state_source: string; review_status: string; listing_visibility: string; platform_restriction: string; business_status: string; is_published: boolean | null; platform_status: string | null };
  const isPublic = s.state_source === 'managed'
    ? s.review_status === 'approved' && s.listing_visibility === 'public' && s.platform_restriction === 'none' && ['OPEN', 'TEMPORARILY_CLOSED'].includes(s.business_status)
    : Boolean(s.is_published) && !['SUSPENDED', 'ARCHIVED'].includes(s.platform_status ?? '');

  return NextResponse.json({
    data: {
      merchant: { ...(merchant.data as unknown as Record<string, unknown>), reviews: null },
      categories: categories.data ?? [],
      products: products.data ?? [],
      videos: videos.data ?? [],
      events: events.data ?? [],
      footerText: settings.footer_text ?? null,
      status: { public: isPublic, stateSource: s.state_source, reviewStatus: s.review_status, restriction: access.restriction },
    },
  }, { headers: noStore });
}
