/* bitesite/components/sections/merchant-card-skeleton.tsx */

"use client";

import { FadeIn } from "@/app/components/animations";

interface MerchantCardSkeletonProps {
  delay?: number;
}

export function MerchantCardSkeleton({ delay = 0 }: MerchantCardSkeletonProps) {
  return (
    <FadeIn delay={delay} duration={0.3}>
      <div className="overflow-hidden rounded-xl border border-[#DDE5DC] bg-[#FAFBF7]">
        {/* Image skeleton */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
        </div>
        {/* Content skeleton */}
        <div className="p-5 space-y-3">
          {/* Tag */}
          <div className="h-5 w-16 rounded-full bg-gray-100 animate-pulse" />
          {/* Title */}
          <div className="h-6 w-3/4 rounded bg-gray-100 animate-pulse" />
          {/* Description lines */}
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
          </div>
          {/* Link */}
          <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
        </div>
      </div>
    </FadeIn>
  );
}
