'use client';

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
const shortMonth = (label: string) => label.split(' ')[0].slice(0, 3);

function Metric({ label, current, previous }: { label: string; current: number; previous: number }) {
  const change = summaryChange(current, previous);
  const words = changeWords(current, previous);
  return (
    <div className="rounded-xl bg-emerald-50 p-3 sm:p-4">
      <p className="text-xs text-emerald-900">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#2C3E2D]">{current.toLocaleString('en-US')}</p>
      <p className={`mt-1 inline-flex items-center gap-0.5 text-xs ${change.direction === 'up' || change.direction === 'new' ? 'text-emerald-800' : change.direction === 'down' ? 'text-amber-800' : 'text-[#6B6560]'}`}>
        {change.direction === 'up' && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
        {change.direction === 'down' && <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
        {words ? (words === 'new' ? `new (0 before)` : words) : 'no visits yet'}
        <span className="sr-only">compared with the same days last month ({previous})</span>
      </p>
    </div>
  );
}

export function MonthlySummaryCard({ merchantId, getHeaders }: { merchantId: string; getHeaders: () => Promise<Record<string, string> | null> }) {
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
  const thisPeriod = dayOf(ranges.thisMonth.to) === 1 ? `${shortMonth(ranges.thisMonth.label)} 1` : `${shortMonth(ranges.thisMonth.label)} ${days}`;
  const lastPeriod = dayOf(ranges.sameDaysLastMonth.to) === 1 ? `${shortMonth(ranges.sameDaysLastMonth.label)} 1` : `${shortMonth(ranges.sameDaysLastMonth.label)} ${dayOf(ranges.sameDaysLastMonth.from)}–${dayOf(ranges.sameDaysLastMonth.to)}`;

  return (
    <section aria-labelledby="month-summary-title" className="rounded-2xl border border-[#DDE5DC] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="month-summary-title" className="font-serif text-xl text-[#2C3E2D]">This month so far</h2>
        <p className="text-xs text-[#6B6560]">{thisPeriod} compared with {lastPeriod}</p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <Metric label="People who opened your page" current={thisMonth.views} previous={sameDaysLastMonth.views} />
        <Metric label="Customers who tried to reach you" current={thisMonth.contacts} previous={sameDaysLastMonth.contacts} />
        <Metric label="Menu views" current={thisMonth.menuViews} previous={sameDaysLastMonth.menuViews} />
      </div>
      <p className="mt-3 text-sm text-[#4B4540]">
        All of {ranges.lastMonth.label}: {lastMonth.views.toLocaleString('en-US')} page views, {lastMonth.contacts.toLocaleString('en-US')} customers reached you (WhatsApp {lastMonth.whatsapp}, calls {lastMonth.calls}, directions {lastMonth.directions}).
      </p>
      <p className="mt-1 text-xs text-[#6B6560]">
        Numbers update every hour. <a href="#stats" className="inline-flex min-h-11 items-center underline underline-offset-2">See all visitor details</a>
      </p>
    </section>
  );
}
