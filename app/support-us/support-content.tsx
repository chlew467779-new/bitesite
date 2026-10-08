"use client";
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
export function SupportContent() {
  const t = useT();
  return <>
    <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-[40px]">{t('support.title')}</h1>
    <p className="mt-4 text-base leading-7">{t('support.soon')}</p>
    <Link href="/" className={buttonClasses({ variant: 'ghost', size: 'md' }) + ' mt-4'}>{t('public.back')}</Link>
  </>;
}
