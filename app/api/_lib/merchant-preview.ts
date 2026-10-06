/* bitesite/app/api/_lib/merchant-preview.ts */

/**
 * Private preview data (SYNC-051), shared by the Owner and Admin preview routes. The caller has
 * already authorized the actor for this restaurant. The merchant row uses the public projection
 * (PUBLIC_MERCHANT_SELECT, no legacy reviews), so a preview never shows more than the public page
 * would. Never cached.
 *
 * Lives under app/api/ because it uses the service-role client (scripts/check-service-role-usage.mjs).
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { PUBLIC_MERCHANT_SELECT } from '@/lib/public-merchant-projection.mjs';
import { getSettings } from '@/lib/settings';
import { DELIVERY_LINK_TYPES } from '@/lib/merchant-links-core.mjs';

// The columns the public page reads (explicit lists; no whole-row reads).
const CATEGORY_COLUMNS = 'id, merchant_id, name, sort_order, created_at';
const PRODUCT_COLUMNS = 'id, merchant_id, category_id, name, description, price, discount_price, image_url, is_featured, is_available, show_prices, sort_order, created_at';
const VIDEO_COLUMNS = 'id, merchant_id, video_url, video_type, caption, sort_order, created_at';
const EVENT_COLUMNS = 'id, merchant_id, title, description, date, time, location, image_url, created_at';

const noStore = { 'Cache-Control': 'no-store' };

type StateRow = {
  state_source: string; review_status: string; listing_visibility: string; platform_restriction: string;
  business_status: string; is_published: boolean | null; platform_status: string | null;
};

export async function merchantPreviewResponse(merchantId: string) {
  const [merchant, state, categories, products, videos, events, deliveryLinks, settings] = await Promise.all([
    supabase.from('merchants').select(PUBLIC_MERCHANT_SELECT).eq('id', merchantId).maybeSingle(),
    supabase.from('merchants').select('state_source, review_status, listing_visibility, platform_restriction, business_status, is_published, platform_status').eq('id', merchantId).maybeSingle(),
    supabase.from('categories').select(CATEGORY_COLUMNS).eq('merchant_id', merchantId).order('sort_order', { ascending: true }),
    supabase.from('products').select(PRODUCT_COLUMNS).eq('merchant_id', merchantId).order('sort_order', { ascending: true }),
    supabase.from('merchant_videos').select(VIDEO_COLUMNS).eq('merchant_id', merchantId).order('sort_order', { ascending: true }),
    supabase.from('events').select(EVENT_COLUMNS).eq('merchant_id', merchantId).order('date', { ascending: true }),
    // Approved delivery links only (is_active): exactly what the public page's order bar shows (T2).
    supabase.from('merchant_external_links').select('link_type, url').eq('merchant_id', merchantId).in('link_type', [...DELIVERY_LINK_TYPES]).eq('is_active', true),
    getSettings(),
  ]);
  const failed = [merchant, state, categories, products, videos, events, deliveryLinks].find((r) => r.error);
  if (failed?.error) {
    console.error('merchant preview read failed:', failed.error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'The preview could not be loaded.' } }, { status: 500, headers: noStore });
  }
  if (!merchant.data || !state.data) {
    return NextResponse.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Restaurant not found.' } }, { status: 404, headers: noStore });
  }

  const s = state.data as StateRow;
  const restriction = s.state_source === 'managed'
    ? s.platform_restriction
    : s.platform_status === 'SUSPENDED' ? 'suspended' : s.platform_status === 'ARCHIVED' ? 'archived' : 'none';
  const isPublic = s.state_source === 'managed'
    ? s.review_status === 'approved' && s.listing_visibility === 'public' && s.platform_restriction === 'none' && ['OPEN', 'TEMPORARILY_CLOSED'].includes(s.business_status)
    : Boolean(s.is_published) && restriction === 'none';

  return NextResponse.json({
    data: {
      merchant: { ...(merchant.data as unknown as Record<string, unknown>), reviews: null },
      categories: categories.data ?? [],
      products: products.data ?? [],
      videos: videos.data ?? [],
      events: events.data ?? [],
      deliveryLinks: deliveryLinks.data ?? [],
      footerText: settings.footer_text ?? null,
      status: { public: isPublic, stateSource: s.state_source, reviewStatus: s.review_status, restriction },
    },
  }, { headers: noStore });
}
