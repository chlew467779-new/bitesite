'use client';

import { ExternalLink, ShoppingBag } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { DELIVERY_LINK_TYPES, type DeliveryLinkType } from '@/lib/merchant-links-core.mjs';

// Brand colours, darkened where needed so white text stays readable.
const APPS: Record<DeliveryLinkType, { name: string; className: string }> = {
  grabfood: { name: 'GrabFood', className: 'bg-[#00A082] hover:bg-[#008c72]' },
  shopeefood: { name: 'ShopeeFood', className: 'bg-[#C93A1B] hover:bg-[#B03217]' },
  foodpanda: { name: 'foodpanda', className: 'bg-[#D70F64] hover:bg-[#BC0D57]' },
};

/** Fixed "Order on …" bar for the restaurant's approved delivery app links (GrabFood, ShopeeFood, foodpanda). */
export function DeliveryOrderButtons({ links, slug }: { links: { link_type: string; url: string }[]; slug: string }) {
  const items = DELIVERY_LINK_TYPES
    .map((type) => ({ type, url: links.find((l) => l.link_type === type)?.url }))
    .filter((item): item is { type: DeliveryLinkType; url: string } => typeof item.url === 'string' && item.url.startsWith('https://'));
  if (items.length === 0) return null;
  const single = items.length === 1;
  return (
    <nav aria-label="Order delivery" className={`fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md gap-2 ${single ? 'sm:left-auto sm:right-6 sm:w-auto' : ''}`}>
      {items.map(({ type, url }) => (
        <a
          key={type}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Order on ${APPS[type].name}`}
          onClick={() => trackEvent('merchant_order_click', { slug, pageType: 'merchant', detail: type })}
          className={`flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98] sm:text-base ${single ? 'px-5' : 'px-2'} ${APPS[type].className}`}
        >
          {single && <ShoppingBag className="h-5 w-5 shrink-0" aria-hidden="true" />}
          <span className="truncate">{single ? `Order on ${APPS[type].name}` : APPS[type].name}</span>
          {single && <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </a>
      ))}
    </nav>
  );
}
