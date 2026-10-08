"use client";
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { useLang, useT } from '@/lib/i18n';
const LOCALES = { en: 'en-MY', zh: 'zh-Hans-MY', ms: 'ms-MY' } as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function policyDate(date: string) {
  // The legal constants contain either an ISO date or an English calendar date.
  // Parse the calendar date in UTC so the viewer's time zone cannot move it back a day.
  const parts = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(date);
  const month = parts ? MONTHS.indexOf(parts[2]) : -1;
  return parts && month >= 0
    ? new Date(Date.UTC(Number(parts[3]), month, Number(parts[1])))
    : new Date(date);
}
export function LegalHeading({ kind }: { kind: 'privacy' | 'terms' }) {
  const t = useT();
  return <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink md:text-[40px]">{t(kind === 'privacy' ? 'legal.privacy' : 'legal.terms')}</h1>;
}
export function LegalDate({ date, version }: { date: string; version?: string }) {
  const t = useT();
  const lang = useLang();
  const parsed = policyDate(date);
  const display = Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <time dateTime={Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10)}>{version ? t('legal.updated', { date: display, version }) : t('legal.effective', { date: display })}</time>;
}
export function LegalNav() {
  const t = useT();
  return <nav aria-label={t('legal.languages')} className="mt-5 flex flex-wrap gap-2">
    <a href="#english" className={buttonClasses({ variant: 'secondary', size: 'md' })}>English</a>
    <a href="#bahasa-melayu" className={buttonClasses({ variant: 'secondary', size: 'md' })}>Bahasa Melayu</a>
  </nav>;
}
export function LegalBack({ create = false }: { create?: boolean }) {
  const t = useT();
  return <Link href={create ? '/merchant/new' : '/'} className={buttonClasses({ variant: 'ghost', size: 'md' }) + ' mt-8'}>{t(create ? 'legal.create' : 'public.back')}</Link>;
}
