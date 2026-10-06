'use client';

import { trackEvent } from '@/lib/analytics';
import { DELIVERY_LINK_TYPES, type DeliveryLinkType } from '@/lib/merchant-links-core.mjs';

// Brand colours, darkened where needed so white text stays readable.
const APPS: Record<DeliveryLinkType, { name: string; className: string }> = {
  grabfood: { name: 'GrabFood', className: 'bg-[#00A082] hover:bg-[#008c72]' },
  shopeefood: { name: 'ShopeeFood', className: 'bg-[#C93A1B] hover:bg-[#B03217]' },
  foodpanda: { name: 'foodpanda', className: 'bg-[#D70F64] hover:bg-[#BC0D57]' },
};

/**
 * Fixed bottom bar with the restaurant's approved delivery app links (GrabFood, ShopeeFood,
 * foodpanda). Render it last on the page: the in-flow spacer keeps the bar from covering the footer.
 */
export function DeliveryOrderButtons({ links, slug }: { links: { link_type: string; url: string }[]; slug: string }) {
  const items = DELIVERY_LINK_TYPES
    .map((type) => ({ type, url: links.find((l) => l.link_type === type)?.url }))
    .filter((item): item is { type: DeliveryLinkType; url: string } => typeof item.url === 'string' && item.url.startsWith('https://'));
  if (items.length === 0) return null;
  const single = items.length === 1;
  return (
    <>
      <div aria-hidden className="h-24" />
      <nav
        aria-label="Order delivery"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-page/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-xl gap-2">
          {items.map(({ type, url }) => (
            <a
              key={type}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Order on ${APPS[type].name}`}
              onClick={() => trackEvent('merchant_order_click', { slug, pageType: 'merchant', detail: type })}
              className={`flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-2xl px-2 text-[15px] font-bold text-white transition-colors ${APPS[type].className}`}
            >
              <span className="truncate">{single ? `Order on ${APPS[type].name}` : APPS[type].name}</span>
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
