/* bitesite/components/sections/story-merchant-link.tsx */

'use client';

import { useT } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { buttonClasses } from '@/components/ui/button';

interface StoryMerchantLinkProps {
  slug: string;
  articleSlug: string;
}

export function StoryMerchantLink({ slug, articleSlug }: StoryMerchantLinkProps) {
  const router = useRouter();
  const t = useT();

  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <a
          href={`/store/${slug}`}
          onClick={async (e) => {
            e.preventDefault();
            // FIX: await trackEvent before navigating so the request completes
            await trackEvent('story_to_merchant', {
              pageType: 'story',
              slug,
              detail: articleSlug,
            });
            router.push(`/store/${slug}`);
          }}
          className={buttonClasses({ variant: 'primary', size: 'lg' })}
        >
          {t('stories.restaurant')}
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
