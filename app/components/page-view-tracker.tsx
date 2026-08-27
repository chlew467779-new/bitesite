/* bitesite/app/components/page-view-tracker.tsx */
'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

interface PageViewTrackerProps {
  pageType: string;
  slug?: string;
}

export function PageViewTracker({ pageType, slug }: PageViewTrackerProps) {
  useEffect(() => {
    trackEvent('page_view', { pageType, slug });
  }, [pageType, slug]);

  return null;
}
