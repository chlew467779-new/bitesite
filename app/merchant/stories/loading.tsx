export default function MerchantStoriesLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading merchant Story workspace"
      className="min-h-screen bg-[#FAFBF7] px-4 py-16"
    >
      <div className="mx-auto max-w-3xl">
        <div className="h-4 w-36 animate-pulse rounded bg-[#E8EEE5]" />
        <div className="mt-6 h-10 w-64 animate-pulse rounded bg-[#E8EEE5]" />
        <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-[#E8EEE5]" />

        <section className="mt-6 space-y-5 rounded-2xl border border-[#DDE5DC] bg-white p-6">
          {["title", "angle", "excerpt"].map((field) => (
            <div key={field}>
              <div className="h-4 w-32 animate-pulse rounded bg-[#E8EEE5]" />
              <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-[#F0F4EC]" />
            </div>
          ))}
          <div>
            <div className="h-4 w-40 animate-pulse rounded bg-[#E8EEE5]" />
            <div className="mt-2 h-40 w-full animate-pulse rounded-lg bg-[#F0F4EC]" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-lg bg-[#E8EEE5]" />
        </section>

        <section className="mt-8">
          <div className="h-6 w-40 animate-pulse rounded bg-[#E8EEE5]" />
          <div className="mt-3 h-20 w-full animate-pulse rounded-lg border border-[#DDE5DC] bg-white" />
        </section>
      </div>
    </main>
  );
}
