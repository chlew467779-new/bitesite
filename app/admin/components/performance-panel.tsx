'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ExternalLink, Minus, RefreshCw, SearchX, AlertTriangle } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from './auth-context';
import RealtimeBadge from './realtime-badge';
import { compareKpi, contactRate, isLowContact, LOW_CONTACT_RATE, MIN_VIEWS_FOR_RATE, PERFORMANCE_DAYS } from '@/lib/admin-performance-core.mjs';

/**
 * Admin Overview (dashboard phase 2, CH 2026-09-29): four numbers against the previous period,
 * views and contacts per day, which restaurants turn views into contacts, and searches that found
 * nothing. Data: /api/admin/performance → public.admin_performance_summary.
 */

type Totals = { visitors: number; pageViews: number; restaurantViews: number; contacts: number };
type Restaurant = { id: string; slug: string; name: string; published: boolean; views: number; visitors: number; whatsapp: number; phone: number; directions: number; contacts: number };
type Summary = {
  days: number; from: string; to: string; hasPrevious: boolean;
  current: Totals; previous: Totals | null;
  daily: { date: string; views: number; contacts: number }[];
  restaurants: Restaurant[];
  searches: { total: number; counted: number; noResults: number; noResultTerms: { term: string; searches: number; visitors: number; lastAt: string }[] };
};

const DETAIL_TABS: { tab: string; label: string }[] = [
  { tab: 'merchants', label: 'Restaurants' },
  { tab: 'search', label: 'All searches' },
  { tab: 'stories-analytics', label: 'Stories' },
  { tab: 'events', label: 'Clicks' },
  { tab: 'referrers', label: 'Where visitors come from' },
  { tab: 'devices', label: 'Devices' },
  { tab: 'locations', label: 'Locations' },
  { tab: 'hourly', label: 'Busy hours' },
  { tab: 'map', label: 'Map' },
];
const ROWS_SHOWN = 10;

const shortDate = (iso: string) => new Date(`${iso}T00:00:00+08:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' });

function Change({ current, previous, days, unit = '%' }: { current: number; previous: number | null | undefined; days: number; unit?: '%' | 'pts' }) {
  if (previous === null || previous === undefined) return null;
  const change = unit === 'pts' ? { delta: Math.round((current - previous) * 10) / 10, pct: null, direction: current > previous ? 'up' : current < previous ? 'down' : 'same' } : compareKpi(current, previous);
  if (!change) return null;
  const tone = change.direction === 'up' ? 'text-emerald-300' : change.direction === 'down' ? 'text-red-300' : 'text-slate-400';
  const Icon = change.direction === 'up' ? ArrowUpRight : change.direction === 'down' ? ArrowDownRight : Minus;
  const text = change.direction === 'same' ? 'No change'
    : unit === 'pts' ? `${change.delta > 0 ? '+' : ''}${change.delta} pts`
    : change.pct === null ? `+${change.delta} (was 0)`
    : `${change.pct > 0 ? '+' : ''}${change.pct}%`;
  return (
    <p className={`mt-2 flex items-center gap-1 text-xs ${tone}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{text} <span className="text-slate-500">vs previous {days} days</span></span>
    </p>
  );
}

function Kpi({ label, value, hint, children }: { label: string; value: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <p className="text-sm font-medium text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {children}
    </div>
  );
}

export default function PerformancePanel({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const { token } = useAuth();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'views' | 'contacts'>('views');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/performance?days=${days}`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) throw new Error(body?.error?.message || 'The performance summary could not be loaded.');
      setData(body.data); setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The performance summary could not be loaded.');
    } finally { setLoading(false); }
  }, [token, days]);
  useEffect(() => { void load(); }, [load]);

  const restaurants = useMemo(() => {
    const list = [...(data?.restaurants ?? [])];
    if (sortBy === 'contacts') list.sort((a, b) => b.contacts - a.contacts || b.views - a.views);
    return list;
  }, [data, sortBy]);
  // Only public pages can be fixed by checking their contact details.
  const lowContact = restaurants.filter((r) => r.published && isLowContact(r));

  const cur = data?.current;
  const prev = data?.previous;
  const rate = cur ? contactRate(cur.contacts, cur.restaurantViews) : null;
  const prevRate = prev ? contactRate(prev.contacts, prev.restaurantViews) : null;
  const chartData = (data?.daily ?? []).map((d) => ({ ...d, label: shortDate(d.date) }));
  const shown = showAll ? restaurants : restaurants.slice(0, ROWS_SHOWN);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data ? `${shortDate(data.from)} – ${shortDate(data.to)} (Malaysia time), ` : ''}how visitors found restaurants and got in touch
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RealtimeBadge />
          <div role="group" aria-label="Period" className="flex rounded-lg border border-slate-700 p-0.5">
            {PERFORMANCE_DAYS.map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => { setDays(d); setShowAll(false); }}
                className={`min-h-10 rounded-md px-3 text-sm ${days === d ? 'bg-amber-500 font-medium text-slate-950' : 'text-slate-300 hover:text-white'}`}>
                {d} days
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!data && loading && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-900" />)}</div>}

      {data && cur && (
        <>
          <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 ${loading ? 'opacity-60' : ''}`}>
            <Kpi label="Visitors" value={cur.visitors.toLocaleString()} hint="Each device counted once">
              <Change current={cur.visitors} previous={prev?.visitors} days={data.days} />
            </Kpi>
            <Kpi label="Page views" value={cur.pageViews.toLocaleString()} hint={`${cur.restaurantViews.toLocaleString()} of them on restaurant pages`}>
              <Change current={cur.pageViews} previous={prev?.pageViews} days={data.days} />
            </Kpi>
            <Kpi label="Contacts" value={cur.contacts.toLocaleString()} hint="Taps on a restaurant's WhatsApp, phone or directions">
              <Change current={cur.contacts} previous={prev?.contacts} days={data.days} />
            </Kpi>
            <Kpi label="Contact rate" value={rate === null ? '–' : `${rate}%`} hint="Contacts per 100 restaurant page views">
              {rate !== null && prevRate !== null && <Change current={rate} previous={prevRate} days={data.days} unit="pts" />}
            </Kpi>
          </div>
          {!data.hasPrevious && (
            <p className="text-xs text-slate-500">No comparison for 90 days: visit details are only kept for 90 days, so there is no earlier period to compare with.</p>
          )}

          {/* Views and contacts per day */}
          <section aria-labelledby="perf-trend" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 id="perf-trend" className="text-base font-semibold text-white">Views and contacts per day</h2>
            <p className="mt-1 text-sm text-slate-400">Bars: page views (left scale). Line: contacts (right scale).</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={16} />
                  <YAxis yAxisId="views" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="contacts" orientation="right" stroke="#475569" tick={{ fill: '#6ee7b7', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                  <Bar yAxisId="views" dataKey="views" name="Page views" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="contacts" dataKey="contacts" name="Contacts" stroke="#34d399" strokeWidth={2} dot={data.days <= 30} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Restaurants: views → contacts */}
          <section aria-labelledby="perf-restaurants" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="perf-restaurants" className="text-base font-semibold text-white">Restaurants: views → contacts</h2>
                <p className="mt-1 text-sm text-slate-400">Which pages turn visitors into WhatsApp, phone and directions taps.</p>
              </div>
              <div role="group" aria-label="Sort restaurants" className="flex rounded-lg border border-slate-700 p-0.5">
                {(['views', 'contacts'] as const).map((key) => (
                  <button key={key} type="button" aria-pressed={sortBy === key} onClick={() => setSortBy(key)}
                    className={`min-h-10 rounded-md px-3 text-sm ${sortBy === key ? 'bg-slate-700 font-medium text-white' : 'text-slate-400 hover:text-white'}`}>
                    Most {key}
                  </button>
                ))}
              </div>
            </div>

            {lowContact.length > 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{lowContact.length <= 3 ? lowContact.map((r) => r.name).join(', ') : `${lowContact.length} restaurants`} {lowContact.length === 1 ? 'has' : 'have'} many views but few contacts (under {LOW_CONTACT_RATE} per 100 views). Check that their WhatsApp or phone number and opening hours are right.</span>
              </p>
            )}

            {restaurants.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No restaurant pages were viewed in this period.</p>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-slate-800">
                  {shown.map((r, index) => {
                    const rRate = contactRate(r.contacts, r.views);
                    const low = r.published && isLowContact(r);
                    return (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                        <span className="w-6 shrink-0 text-right text-sm tabular-nums text-slate-500">{index + 1}</span>
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="truncate text-sm font-medium text-white">{r.name}</p>
                          <p className="text-xs text-slate-500">
                            {r.contacts > 0 ? `WhatsApp ${r.whatsapp} · Phone ${r.phone} · Directions ${r.directions}` : 'No contacts yet'}
                            {!r.published && ' · not public now'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm tabular-nums">
                          <span className="w-16 text-right text-slate-300" title="Page views">{r.views.toLocaleString()}<span className="block text-xs text-slate-500">views</span></span>
                          <span className="w-16 text-right text-emerald-300" title="Contacts">{r.contacts.toLocaleString()}<span className="block text-xs text-slate-500">contacts</span></span>
                          <span className={`w-16 text-right ${low ? 'font-medium text-amber-300' : 'text-slate-300'}`} title={r.views < MIN_VIEWS_FOR_RATE ? `Rate shown from ${MIN_VIEWS_FOR_RATE} views` : 'Contacts per 100 views'}>
                            {r.views < MIN_VIEWS_FOR_RATE || rRate === null ? '–' : `${rRate}%`}<span className="block text-xs font-normal text-slate-500">rate</span>
                          </span>
                          {r.published ? (
                            <a href={`/store/${encodeURIComponent(r.slug)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:text-white">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : <span className="w-11" aria-hidden />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {restaurants.length > ROWS_SHOWN && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 min-h-11 text-sm text-amber-300 hover:text-amber-200">
                    {showAll ? 'Show top 10 only' : `Show all ${restaurants.length} restaurants`}
                  </button>
                )}
                <p className="mt-2 text-xs text-slate-500">Rate shows once a restaurant has {MIN_VIEWS_FOR_RATE} views.</p>
              </>
            )}
          </section>

          {/* Searches that found nothing */}
          <section aria-labelledby="perf-search" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 id="perf-search" className="flex items-center gap-2 text-base font-semibold text-white"><SearchX className="h-4 w-4 text-slate-400" aria-hidden /> Searches that found nothing</h2>
            <p className="mt-1 text-sm text-slate-400">
              What visitors looked for on the homepage and did not find. Ideas for restaurants, dishes or areas to add.
            </p>
            {data.searches.noResultTerms.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">
                {data.searches.counted === 0 ? 'No searches checked yet in this period.' : 'Every search found at least one restaurant.'}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-800">
                {data.searches.noResultTerms.map((t) => (
                  <li key={t.term} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0 break-words text-sm font-medium text-white">“{t.term}”</span>
                    <span className="text-xs tabular-nums text-slate-400">{t.searches} {t.searches === 1 ? 'search' : 'searches'} · {t.visitors} {t.visitors === 1 ? 'visitor' : 'visitors'} · last {new Date(t.lastAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              {data.searches.noResults} of {data.searches.counted} checked searches found nothing.
              {data.searches.total > data.searches.counted && ` ${data.searches.total - data.searches.counted} older searches were recorded before results were counted.`}
            </p>
          </section>

          <section aria-labelledby="perf-more" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 id="perf-more" className="text-base font-semibold text-white">More detail</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {DETAIL_TABS.map((d) => (
                <button key={d.tab} type="button" onClick={() => onOpenTab(d.tab)} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:border-slate-500 hover:text-white">{d.label}</button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
