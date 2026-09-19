'use client';

import { ExternalLink, ShoppingBag } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export function GrabFoodOrderButton({ url, slug }: { url: string; slug: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('merchant_order_click', { slug, pageType: 'merchant', detail: 'grabfood' })}
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl bg-[#00A082] px-5 py-3.5 font-semibold text-white shadow-lg transition-transform hover:bg-[#008c72] active:scale-[0.98] sm:left-auto sm:right-6 sm:w-auto"
    >
      <ShoppingBag className="h-5 w-5" />
      Order on GrabFood
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
