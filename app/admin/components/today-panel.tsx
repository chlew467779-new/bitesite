'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuth } from './auth-context';
import { ISSUE_LABELS, type IssueKey } from '@/lib/admin-today-core.mjs';
import { daysWaiting } from '@/lib/site-feedback-core.mjs';

/**
 * Admin home (dashboard phase 1, CH 2026-09-29): what needs doing now, pilot places, and
 * restaurants with gaps. Every item opens the page where it is fixed.
 */

type Attention = Record<string, number> & { notifications?: { pending: number; failed: number }; ideas?: { count: number; oldestAt: string | null } };
type Row = { id: string; slug: string; name: string; isPublic: boolean; status: 'public' | 'waiting' | 'draft' | 'suspended'; issues: IssueKey[] };
type Today = { capacity: { intakeMode: 'open' | 'limited' | 'paused'; pending: number; pendingCapacity: number; pilotUsed: number; pilotCapacity: number }; incomplete: Row[] };

const QUEUES: { key: string; tab: string; label: string; hint: string }[] = [
  { key: 'restaurant-reviews', tab: 'restaurant-reviews', label: 'Restaurants to review', hint: 'New restaurants waiting to go live' },
  { key: 'link-reviews', tab: 'link-reviews', label: 'Change requests', hint: 'Links, name, address or cuisine changes' },
  { key: 'reports', tab: 'reports', label: 'Visitor reports', hint: 'Problems visitors flagged on a page' },
  { key: 'feedback', tab: 'feedback', label: 'Problems reported', hint: 'A merchant or visitor says something is wrong' },
  { key: 'story-submissions', tab: 'story-submissions', label: 'Stories to review', hint: 'Stories restaurants sent in' },
];
const STATUS_STYLE: Record<Row['status'], string> = {
  public: 'bg-emerald-500/15 text-emerald-300',
  waiting: 'bg-amber-500/15 text-amber-300',
  draft: 'bg-slate-700 text-slate-300',
  suspended: 'bg-red-500/15 text-red-300',
};
const ISSUE_KEYS = Object.keys(ISSUE_LABELS) as IssueKey[];

function Meter({ label, used, total, hint }: { label: string; used: number; total: number; hint: string }) {
  const ratio = total > 0 ? Math.min(used / total, 1) : 0;
  const tone = ratio >= 0.9 ? 'bg-red-400' : ratio >= 0.7 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-sm tabular-nums text-white"><span className="text-lg font-semibold">{used}</span> / {total}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={used} aria-label={label}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default function TodayPanel({ onOpenTab, onOpenMerchant }: { onOpenTab: (tab: string) => void; onOpenMerchant: (id: string) => void }) {
  const { token } = useAuth();
  const [attention, setAttention] = useState<Attention | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [issueFilter, setIssueFilter] = useState<IssueKey | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { 'x-admin-token': token };
      const [a, t] = await Promise.all([
        fetch('/api/admin/attention', { headers, cache: 'no-store' }).then((r) => r.json().then((b) => (r.ok ? b.data : Promise.reject(new Error(b.error?.message || 'Could not load the counts.'))))),
        fetch('/api/admin/today', { headers, cache: 'no-store' }).then((r) => r.json().then((b) => (r.ok ? b.data : Promise.reject(new Error(b.error?.message || 'Could not load today’s summary.'))))),
      ]);
      setAttention(a); setToday(t); setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load today’s summary.');
    } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const waiting = QUEUES.map((q) => ({ ...q, count: attention?.[q.key] ?? 0 }));
  const busyQueues = waiting.filter((q) => q.count > 0);
  const failedEmails = attention?.notifications?.failed ?? 0;
  const ideas = attention?.ideas;
  const ideaAge = daysWaiting(ideas?.oldestAt);
  const issueCounts = useMemo(() => {
    const counts = Object.fromEntries(ISSUE_KEYS.map((k) => [k, 0])) as Record<IssueKey, number>;
    for (const row of today?.incomplete ?? []) for (const issue of row.issues) counts[issue] += 1;
    return counts;
  }, [today]);
  const rows = (today?.incomplete ?? []).filter((r) => !issueFilter || r.issues.includes(issueFilter));
  const dateText = new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Today</h1>
          <p className="mt-1 text-sm text-slate-400">{dateText} · what needs you, and restaurants to tidy up</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}

      {/* Waiting for you */}
      <section aria-labelledby="today-waiting" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 id="today-waiting" className="text-base font-semibold text-white">Waiting for you</h2>
        {attention && busyQueues.length === 0 && failedEmails === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Nothing is waiting. All clear.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {busyQueues.map((q) => (
              <button key={q.key} type="button" onClick={() => onOpenTab(q.tab)} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left transition-colors hover:bg-amber-500/10">
                <p className="text-3xl font-semibold tabular-nums text-amber-300">{q.count}</p>
                <p className="mt-1 text-sm font-medium text-white">{q.label}</p>
                <p className="text-xs text-slate-400">{q.hint}</p>
              </button>
            ))}
            {failedEmails > 0 && (
              <button type="button" onClick={() => onOpenTab('restaurant-reviews')} className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-left transition-colors hover:bg-red-500/10">
                <p className="text-3xl font-semibold tabular-nums text-red-300">{failedEmails}</p>
                <p className="mt-1 text-sm font-medium text-white">Emails that failed</p>
                <p className="text-xs text-slate-400">Gave up after 5 tries; see the email status</p>
              </button>
            )}
          </div>
        )}
        {attention && busyQueues.length > 0 && busyQueues.length < waiting.length && (
          <p className="mt-3 text-xs text-slate-500">Nothing in: {waiting.filter((q) => q.count === 0).map((q) => q.label.toLowerCase()).join(', ')}.</p>
        )}
      </section>

      {/* Ideas are kept for a batch (CH: every two months), so they sit apart from the queues above. */}
      {ideas && ideas.count > 0 && (
        <button type="button" onClick={() => onOpenTab('feedback')} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-left transition-colors hover:bg-slate-800/60">
          <span className="text-sm text-slate-200"><span className="font-semibold text-white">{ideas.count}</span> ideas and design comments saved for the next batch</span>
          {ideaAge !== null && <span className={`text-xs ${ideaAge >= 60 ? 'font-medium text-amber-300' : 'text-slate-400'}`}>Oldest: {ideaAge} {ideaAge === 1 ? 'day' : 'days'}{ideaAge >= 60 ? ' · time for a batch' : ''}</span>}
        </button>
      )}

      {/* Pilot places */}
      {today && (
        <section aria-labelledby="today-pilot" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="today-pilot" className="text-base font-semibold text-white">New restaurants</h2>
            <button type="button" onClick={() => onOpenTab('restaurant-reviews')} className={`min-h-11 rounded-full px-4 text-sm font-medium ${today.capacity.intakeMode === 'paused' ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {today.capacity.intakeMode === 'paused' ? 'Paused' : today.capacity.intakeMode === 'open' ? 'Open, no limit' : 'Limited'} · Change
            </button>
          </div>
          {today.capacity.intakeMode === 'paused' && <p className="mt-2 text-sm text-red-300">Nobody can submit a new restaurant until you reopen.</p>}
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {today.capacity.intakeMode === 'limited'
              ? <Meter label="Restaurants in the pilot" used={today.capacity.pilotUsed} total={today.capacity.pilotCapacity} hint="Live or waiting for review. New restaurants cannot submit when this is full." />
              : <div><p className="text-sm font-medium text-slate-200">Restaurants in the pilot</p><p className="mt-1 text-lg font-semibold tabular-nums text-white">{today.capacity.pilotUsed}</p><p className="mt-1 text-xs text-slate-500">Live or waiting for review{today.capacity.intakeMode === 'open' ? '; no limit while Open' : ''}.</p></div>}
            <Meter label="Waiting for review" used={today.capacity.pending} total={today.capacity.pendingCapacity} hint="Restaurants can only submit while there is room here." />
          </div>
        </section>
      )}

      {/* Restaurants to tidy up */}
      {today && (
        <section aria-labelledby="today-gaps" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 id="today-gaps" className="text-base font-semibold text-white">Restaurants to tidy up</h2>
          <p className="mt-1 text-sm text-slate-400">Live restaurants first. Tap a gap to filter.</p>
          {today.incomplete.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Every restaurant has its basics in place.</p>
          ) : (
            <>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button type="button" aria-pressed={issueFilter === null} onClick={() => setIssueFilter(null)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${issueFilter === null ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-700 text-slate-300'}`}>All ({today.incomplete.length})</button>
                {ISSUE_KEYS.filter((k) => issueCounts[k] > 0).map((k) => (
                  <button key={k} type="button" aria-pressed={issueFilter === k} onClick={() => setIssueFilter(issueFilter === k ? null : k)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${issueFilter === k ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-700 text-slate-300'}`}>
                    {ISSUE_LABELS[k]} ({issueCounts[k]})
                  </button>
                ))}
              </div>
              <ul className="mt-3 divide-y divide-slate-800">
                {rows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{row.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[row.status]}`}>{row.status}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.issues.map((issue) => <span key={issue} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{ISSUE_LABELS[issue]}</span>)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {row.isPublic && (
                        <a href={`/store/${encodeURIComponent(row.slug)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-700 px-3 text-sm text-slate-300">
                          Page <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button type="button" onClick={() => onOpenMerchant(row.id)} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-950">Fix</button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
