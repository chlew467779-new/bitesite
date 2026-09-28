/* bitesite/app/admin/components/reports-inbox.tsx */
'use client';

/**
 * Visitor Reports: problems visitors reported on public restaurant and Story pages, newest first.
 * A report is a hint, not a fact: check it (call the restaurant, look at the Story), fix the page
 * in Merchant Manager / Stories Editor if needed, then mark it resolved or dismissed with a note.
 */

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from './auth-context';
import { reasonLabel, type ReportItem, type ReportStatus } from '@/lib/public-report-core.mjs';

type Filter = ReportStatus | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

export default function ReportsInbox() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<Filter>('new');
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [counts, setCounts] = useState<Record<ReportStatus, number> | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [itemError, setItemError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setItems(null);
    try {
      const response = await fetch(`/api/admin/reports${filter === 'all' ? '' : `?status=${filter}`}`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setError(data?.error?.message || 'Could not load the reports.'); return; }
      setItems(data.data.items as ReportItem[]);
      setCounts(data.data.counts as Record<ReportStatus, number>);
    } catch {
      setError('Could not reach the server.');
    }
  }, [token, filter]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: ReportItem, status: ReportStatus) => {
    if (!token || working) return;
    setWorking(item.id);
    setItemError((e) => ({ ...e, [item.id]: '' }));
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: item.id, status, note: (notes[item.id] ?? '').trim() || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setItemError((e) => ({ ...e, [item.id]: data?.error?.message || 'Not saved.' })); return; }
      await load();
    } catch {
      setItemError((e) => ({ ...e, [item.id]: 'Could not reach the server. Try again.' }));
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Visitor Reports</h2>
        <p className="text-sm text-slate-400">Visitors can report a problem on any restaurant or Story page. A report is a hint, not a fact: check it first, fix the page in Merchant Manager or Stories Editor if needed, then mark it resolved or dismissed.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report status">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} onClick={() => setFilter(f.value)}
            className={`min-h-10 rounded-lg px-3 text-sm ${filter === f.value ? 'bg-amber-500 font-medium text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
            {f.label}{counts && f.value !== 'all' ? ` (${counts[f.value]})` : ''}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!items && !error && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
      {items && items.length === 0 && <p className="text-sm text-slate-400">No reports here.</p>}
      {items?.map((item) => {
        const href = item.targetType === 'merchant' ? `/store/${encodeURIComponent(item.slug)}` : `/stories/${encodeURIComponent(item.slug)}`;
        return (
          <div key={item.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">{item.targetType === 'merchant' ? 'Restaurant' : 'Story'}</span>
                {item.targetGone ? <>{item.name} <span className="text-xs font-normal text-[#6B6560]">(no longer exists)</span></>
                  : <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">{item.name} <ExternalLink className="h-3 w-3" /></a>}
              </p>
              <p className="text-xs text-[#6B6560]">{new Date(item.createdAt).toLocaleString()} · {item.status}</p>
            </div>
            <p className="mt-2 text-sm font-medium">{reasonLabel(item.targetType, item.reason)}</p>
            {item.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.note}</p>}
            {item.contactEmail && <p className="mt-1 text-sm">Contact: <a href={`mailto:${item.contactEmail}`} className="underline">{item.contactEmail}</a></p>}
            {item.sameTargetOpen > 0 && <p className="mt-1 text-xs text-amber-800">{item.sameTargetOpen} other open report{item.sameTargetOpen > 1 ? 's' : ''} for this page.</p>}
            {item.adminNote && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-[#6B6560]">Admin note: {item.adminNote}</p>}
            <label className="mt-3 block text-sm">Note (optional, for the team)
              <textarea rows={2} maxLength={1000} value={notes[item.id] ?? ''} onChange={(event) => setNotes((n) => ({ ...n, [item.id]: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.status !== 'resolved' && <button type="button" disabled={working !== null} onClick={() => void decide(item, 'resolved')} className="min-h-10 rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50">Resolved</button>}
              {item.status !== 'dismissed' && <button type="button" disabled={working !== null} onClick={() => void decide(item, 'dismissed')} className="min-h-10 rounded-lg border border-[#C9D6C7] px-4 text-sm font-medium disabled:opacity-50">Dismiss</button>}
              {item.status !== 'new' && <button type="button" disabled={working !== null} onClick={() => void decide(item, 'new')} className="min-h-10 rounded-lg border border-[#C9D6C7] px-4 text-sm font-medium disabled:opacity-50">Reopen</button>}
            </div>
            {itemError[item.id] && <p className="mt-2 text-sm text-red-700" role="alert">{itemError[item.id]}</p>}
          </div>
        );
      })}
    </div>
  );
}
