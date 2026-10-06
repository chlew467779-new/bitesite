/* bitesite/components/sections/merchant-card-skeleton.tsx */

/** Placeholder with the same shape as MerchantCard while restaurants load. */
export function MerchantCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2.5">
      <div className="h-[196px] animate-pulse rounded-[20px] bg-surface sm:h-auto sm:aspect-[4/3]" />
      <div className="flex justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/5 animate-pulse rounded bg-surface" />
          <div className="h-4 w-2/5 animate-pulse rounded bg-surface" />
        </div>
        <div className="h-4 w-12 animate-pulse rounded bg-surface" />
      </div>
    </div>
  );
}
