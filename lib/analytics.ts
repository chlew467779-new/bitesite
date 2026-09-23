export const EventTypes = {
  PAGE_VIEW: 'page_view',
  WHATSAPP_CLICK: 'whatsapp_click',
  BOOKING_SUBMIT: 'booking_submit',
  SHARE: 'share',
  SEARCH: 'search',
  MAP_MARKER_CLICK: 'map_marker_click',
  STORY_TO_MERCHANT: 'story_to_merchant',
  MERCHANT_ORDER_CLICK: 'merchant_order_click',
  DIRECTIONS_CLICK: 'directions_click',
  PHONE_CLICK: 'phone_click',
  MENU_VIEW: 'menu_view',
  WEBSITE_CLICK: 'website_click',
  EMAIL_CLICK: 'email_click',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

export function classifyReferrer(referrer: string): string {
  if (!referrer || referrer === 'null' || referrer === 'undefined') return 'direct';
  const r = referrer.toLowerCase();
  
  // Search engines
  if (r.includes('google')) return 'google';
  if (r.includes('bing')) return 'bing';
  if (r.includes('yahoo')) return 'yahoo';
  if (r.includes('duckduckgo')) return 'duckduckgo';
  if (r.includes('baidu')) return 'baidu';
  
  // Social media
  if (r.includes('instagram')) return 'instagram';
  if (r.includes('facebook')) return 'facebook';
  if (r.includes('whatsapp')) return 'whatsapp';
  if (r.includes('twitter') || r.includes('x.com')) return 'twitter';
  if (r.includes('linkedin')) return 'linkedin';
  if (r.includes('youtube')) return 'youtube';
  if (r.includes('reddit')) return 'reddit';
  if (r.includes('pinterest')) return 'pinterest';
  if (r.includes('tiktok')) return 'tiktok';
  if (r.includes('telegram')) return 'telegram';
  if (r.includes('discord')) return 'discord';
  
  // Internal
  if (r.includes('bitesite')) return 'internal';
  
  return 'other';
}

/**
 * Boundary marker for surfaces that render real public layout components but must never record
 * analytics: the development layout fixtures, and (later) Admin/Merchant preview.
 *
 * The layouts themselves embed trackers — MenuViewTracker fires a `menu_view` beacon as soon as
 * the menu scrolls into view, with no user interaction — so "just don't click anything" is not
 * enough, and a preview opened against a production database would otherwise write real rows.
 *
 * The marker is an attribute on a wrapper element rendered *around* the layout, so it is present
 * in the same DOM commit as the trackers themselves: their effects run after that commit, so the
 * lookup below always sees it. It is deliberately not module state (module state would leak
 * between client-side navigations) and not written from an effect (that would race the trackers).
 */
export const ANALYTICS_SUPPRESSED_ATTRIBUTE = 'data-bs-analytics';
export const ANALYTICS_SUPPRESSED_VALUE = 'off';
/** Spread onto the wrapper element that encloses a non-recording surface. */
export const analyticsSuppressedProps = { [ANALYTICS_SUPPRESSED_ATTRIBUTE]: ANALYTICS_SUPPRESSED_VALUE } as const;

export function isAnalyticsSuppressed(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document.querySelector(`[${ANALYTICS_SUPPRESSED_ATTRIBUTE}="${ANALYTICS_SUPPRESSED_VALUE}"]`) !== null;
  } catch {
    // A failed lookup must never silently enable tracking on a preview surface.
    return true;
  }
}

export async function trackEvent(
  eventType: EventType,
  data: { slug?: string; path?: string; pageType?: string; detail?: string }
) {
  if (isAnalyticsSuppressed()) return;

  const payload = {
    eventType,
    slug: data.slug,
    path: data.path || (typeof window !== 'undefined' ? window.location.pathname : ''),
    pageType: data.pageType,
    eventDetail: data.detail,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  };
  
  const json = JSON.stringify(payload);
  
  // FIX: 优先使用 navigator.sendBeacon —— 浏览器保证请求一定发出，不受页面跳转影响
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([json], { type: 'application/json' });
    const sent = navigator.sendBeacon('/api/track', blob);
    if (sent) return; // 成功加入发送队列，直接返回
  }
  
  // fallback: fetch with keepalive（旧浏览器）
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    });
  } catch {
    // 静默失败，不影响用户体验
  }
}
