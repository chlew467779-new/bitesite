export const EventTypes = {
  PAGE_VIEW: 'page_view',
  WHATSAPP_CLICK: 'whatsapp_click',
  BOOKING_SUBMIT: 'booking_submit',
  SHARE: 'share',
  SEARCH: 'search',
  MAP_MARKER_CLICK: 'map_marker_click',
  STORY_TO_MERCHANT: 'story_to_merchant',
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

export async function trackEvent(
  eventType: EventType,
  data: { slug?: string; path?: string; pageType?: string; detail?: string }
) {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        slug: data.slug,
        path: data.path || (typeof window !== 'undefined' ? window.location.pathname : ''),
        pageType: data.pageType,
        eventDetail: data.detail,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      }),
      keepalive: true,
    });
  } catch {
    // 静默失败，不影响用户体验
  }
}
