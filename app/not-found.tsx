import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-20">
      <section className="w-full max-w-xl rounded-3xl border border-[#DDE5DC] bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-6xl font-semibold text-[#5A8F6E]">404</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#2C3E2D] sm:text-4xl">
          This page isn&apos;t on the menu
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[#6B6560]">
          The link may be outdated, or this story is no longer available.
          Let&apos;s get you back to discovering something delicious.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#5A8F6E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#4A7A5E] focus:outline-none focus:ring-2 focus:ring-[#5A8F6E] focus:ring-offset-2"
        >
          Explore BiteSite
        </Link>
      </section>
    </main>
  );
}
