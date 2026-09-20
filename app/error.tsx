"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-20">
      <section className="w-full max-w-xl rounded-3xl border border-[#DDE5DC] bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5A8F6E]">
          BiteSite
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-[#2C3E2D] sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[#6B6560]">
          We couldn&apos;t load this page right now. Please try again, or return to
          BiteSite and continue exploring local food stories.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-[#5A8F6E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#4A7A5E] focus:outline-none focus:ring-2 focus:ring-[#5A8F6E] focus:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-[#DDE5DC] px-6 py-3 text-sm font-semibold text-[#2C3E2D] transition hover:bg-[#F0F4EC] focus:outline-none focus:ring-2 focus:ring-[#5A8F6E] focus:ring-offset-2"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
