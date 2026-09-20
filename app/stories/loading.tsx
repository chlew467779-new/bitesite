export default function StoriesLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading stories"
      className="min-h-screen bg-[#FAFBF7]"
    >
      <section className="px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto h-10 w-48 animate-pulse rounded bg-[#E8EEE5]" />
        <div className="mx-auto mt-5 h-5 w-72 max-w-full animate-pulse rounded bg-[#E8EEE5]" />
      </section>

      <div className="mx-auto max-w-4xl px-4">
        <div className="flex gap-2 overflow-hidden pb-2">
          {["all", "one", "two"].map((key) => (
            <div
              key={key}
              className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-[#E8EEE5]"
            />
          ))}
        </div>
        <div className="mt-4 h-4 w-24 animate-pulse rounded bg-[#E8EEE5]" />
      </div>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {["first", "second", "third", "fourth"].map((key) => (
            <article
              key={key}
              className="overflow-hidden rounded-2xl border border-[#DDE5DC] bg-white"
            >
              <div className="aspect-[16/9] animate-pulse bg-[#E8EEE5]" />
              <div className="space-y-3 p-5">
                <div className="h-4 w-24 animate-pulse rounded bg-[#E8EEE5]" />
                <div className="h-6 w-4/5 animate-pulse rounded bg-[#E8EEE5]" />
                <div className="h-4 w-full animate-pulse rounded bg-[#E8EEE5]" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-[#E8EEE5]" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
