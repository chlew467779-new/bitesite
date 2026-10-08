"use client";

import Link from "next/link";
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';

export default function NotFound() {
  const t = useT();
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-20">
      <section className="w-full max-w-xl rounded-[20px] border border-line bg-page p-8 text-center sm:p-12">
        <p className="text-6xl font-semibold text-brand">404</p>
        <h1 className="mt-4 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink md:text-[40px]">
          {t('notFound.title')}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted">
          {t('notFound.body')}</p>
        <Link
          href="/"
          className={buttonClasses({ variant: 'primary', size: 'md' }) + ' mt-8'}
        >
          {t('notFound.explore')}</Link>
      </section>
    </main>
  );
}
