/* bitesite/app/store/[merchant]/loading.tsx */

export default function MerchantLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 animate-pulse">
      {/* Hero Skeleton */}
      <div className="h-64 sm:h-80 lg:h-96 bg-gray-200" />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Title + Tags */}
        <div className="space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-3/4 bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
        </div>

        {/* Menu Categories */}
        <div className="space-y-6 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-32 bg-gray-200 rounded" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100"
                  >
                    <div className="w-20 h-20 bg-gray-200 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-gray-200 rounded" />
                      <div className="h-3 w-full bg-gray-200 rounded" />
                      <div className="h-3 w-2/3 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
