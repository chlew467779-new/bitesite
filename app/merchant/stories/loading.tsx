'use client';
import { useT } from '@/lib/i18n';

export default function MerchantStoriesLoading() {
  const t = useT();
  return (
    <main
      aria-busy="true"
      aria-label={t('owner.stories.loadingMerchantStoryWorkspace')}
      className="min-h-screen bg-page px-4 py-16"
    >
      <div className="mx-auto max-w-3xl">
        <div className="h-4 w-36 animate-pulse rounded bg-surface" />
        <div className="mt-6 h-10 w-64 animate-pulse rounded bg-surface" />
        <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-surface" />

        <section className="mt-6 space-y-5 rounded-[20px] border border-line bg-white p-6">
          {["title", "angle", "excerpt"].map((field) => (
            <div key={field}>
              <div className="h-4 w-32 animate-pulse rounded bg-surface" />
              <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-surface" />
            </div>
          ))}
          <div>
            <div className="h-4 w-40 animate-pulse rounded bg-surface" />
            <div className="mt-2 h-40 w-full animate-pulse rounded-lg bg-surface" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-lg bg-surface" />
        </section>

        <section className="mt-8">
          <div className="h-6 w-40 animate-pulse rounded bg-surface" />
          <div className="mt-3 h-20 w-full animate-pulse rounded-lg border border-line bg-white" />
        </section>
      </div>
    </main>
  );
}
