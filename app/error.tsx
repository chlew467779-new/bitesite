"use client";

import Link from "next/link";
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { useEffect } from "react";
import { reportBrowserError } from "@/lib/report-browser-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
    reportBrowserError(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-20">
      <section className="w-full max-w-xl rounded-[20px] border border-line bg-page p-8 text-center sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          BiteSite
        </p>
        <h1 className="mt-4 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink md:text-[40px]">
          {t('error.title')}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted">
          {t('error.body')}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className={buttonClasses({ variant: 'primary', size: 'md' })}
          >
            {t('public.retry')}</button>
          <Link
            href="/"
            className={buttonClasses({ variant: 'secondary', size: 'md' })}
          >
            {t('public.home')}</Link>
        </div>
      </section>
    </main>
  );
}
