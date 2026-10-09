'use client';
import { useT, useLang } from '@/lib/i18n';

/**
 * "This month vs last month" (CH 2026-09-30), shown near the top of the dashboard once the page is
 * live: page views, customers who tried to reach the restaurant and menu views this month so far,
 * each compared with the same days last month, plus last month's total. Fails quietly: the full
 * Visitors section below still works on its own.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { changeWords, summaryChange, type SummaryRanges, type SummaryTotals } from '@/lib/monthly-summary-core.mjs';

type Summary = { ranges: SummaryRanges; thisMonth: SummaryTotals; sameDaysLastMonth: SummaryTotals; lastMonth: SummaryTotals };

const dayOf = (date: string) => Number(date.slice(8, 10));
const monthLabel = (date: string, locale: string, year = false) => new Intl.DateTimeFormat(locale, { month: year ? 'long' : 'short', ...(year ? { year: 'numeric' as const } : {}), timeZone: 'UTC' }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));

function Metric({ label, current, previous }: { label: string; current: number; previous: number }) {
  const t = useT();
  const change = summaryChange(current, previous);
  const words = changeWords(current, previous);
  return (
    <div className="rounded-xl bg-brand-soft p-3 sm:p-4">
      <p className="text-xs text-brand">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{current.toLocaleString('en-US')}</p>
      <p className={`mt-1 inline-flex items-center gap-0.5 text-xs ${change.direction === 'up' || change.direction === 'new' ? 'text-brand' : change.direction === 'down' ? 'text-amber-800' : 'text-muted'}`}>
        {change.direction === 'up' && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
        {change.direction === 'down' && <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
        {words ? (words === 'new' ? t('owner.analytics.new0Before') : words === 'the same' ? t('owner.analytics.theSame') : t(change.direction === 'up' ? 'owner.analytics.increase' : 'owner.analytics.decrease', { percent: change.percent ?? 0 })) : t('owner.analytics.noVisitsYet')}
        <span className="sr-only">{t('owner.analytics.comparedWithTheSameDaysLast', { change: previous })}</span>
      </p>
    </div>
  );
}

export function MonthlySummaryCard({ merchantId, getHeaders }: { merchantId: string; getHeaders: () => Promise<Record<string, string> | null> }) {
  const t = useT();
  const lang = useLang();
  const locale = lang === 'zh' ? 'zh-Hans-MY' : lang === 'ms' ? 'ms-MY' : 'en-MY';
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const response = await fetch(`/api/merchant/restaurants/${encodeURIComponent(merchantId)}/summary`, { headers, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.data) setSummary(body.data as Summary);
    } catch { /* the Visitors section below still shows the numbers */ }
  }, [merchantId, getHeaders]);
  useEffect(() => { void load(); }, [load]);

  if (!summary) return null;
  const { ranges, thisMonth, sameDaysLastMonth, lastMonth } = summary;
  const days = `${dayOf(ranges.thisMonth.from)}–${dayOf(ranges.thisMonth.to)}`;
  const thisPeriod = dayOf(ranges.thisMonth.to) === 1 ? `${monthLabel(ranges.thisMonth.from, locale)} 1` : `${monthLabel(ranges.thisMonth.from, locale)} ${days}`;
  const lastPeriod = dayOf(ranges.sameDaysLastMonth.to) === 1 ? `${monthLabel(ranges.sameDaysLastMonth.from, locale)} 1` : `${monthLabel(ranges.sameDaysLastMonth.from, locale)} ${dayOf(ranges.sameDaysLastMonth.from)}–${dayOf(ranges.sameDaysLastMonth.to)}`;

  return (
    <section aria-labelledby="month-summary-title" className="rounded-[20px] border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="month-summary-title" className="font-extrabold tracking-[-0.02em] text-xl text-ink">{t('owner.analytics.thisMonthSoFar')}</h2>
        <p className="text-xs text-muted">{t('owner.analytics.periodComparison', { current: thisPeriod, previous: lastPeriod })}</p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <Metric label={t('owner.analytics.peopleWhoOpenedYourPage')} current={thisMonth.views} previous={sameDaysLastMonth.views} />
        <Metric label={t('owner.analytics.customersWhoTriedToReachYou')} current={thisMonth.contacts} previous={sameDaysLastMonth.contacts} />
        <Metric label={t('owner.analytics.menuViews')} current={thisMonth.menuViews} previous={sameDaysLastMonth.menuViews} />
      </div>
      <p className="mt-3 text-sm text-ink-2">
        {t(lastMonth.views === 1 && lastMonth.contacts === 1 ? 'owner.analytics.allOfPageViewsCustomersReachedViewsAndContactsOne' : lastMonth.views === 1 ? 'owner.analytics.allOfPageViewsCustomersReachedViewsOne' : lastMonth.contacts === 1 ? 'owner.analytics.allOfPageViewsCustomersReachedContactsOne' : 'owner.analytics.allOfPageViewsCustomersReached', { month: monthLabel(ranges.lastMonth.from, locale, true), views: lastMonth.views.toLocaleString('en-US'), contacts: lastMonth.contacts.toLocaleString('en-US'), whatsapp: lastMonth.whatsapp, calls: lastMonth.calls, directions: lastMonth.directions })}
      </p>
      <p className="mt-1 text-xs text-muted">
        {t('owner.analytics.numbersUpdateEveryHour')} <a href="#stats" className="inline-flex min-h-11 items-center underline underline-offset-2">{t('owner.analytics.seeAllVisitorDetails')}</a>
      </p>
    </section>
  );
}
