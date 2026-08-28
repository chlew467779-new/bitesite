/* bitesite/components/sections/story-merchant-link.tsx */

'use client';

import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

interface StoryMerchantLinkProps {
  slug: string;
}

export function StoryMerchantLink({ slug }: StoryMerchantLinkProps) {
  const router = useRouter();

  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <a
          href={`/store/${slug}`}
          onClick={async (e) => {
            e.preventDefault();
            // FIX: await trackEvent before navigating so the request completes
            await trackEvent('story_to_merchant', { pageType: 'story', slug });
            router.push(`/store/${slug}`);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[#5A8F6E] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Read more about this restaurant
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      </div>
    </section>
  );
}
