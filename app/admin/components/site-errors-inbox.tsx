/* bitesite/app/admin/components/site-errors-inbox.tsx */
'use client';

/**
 * Site Errors (SYNC-070): what broke on the website, one row per kind of error, newest first.
 * The server records them on its own; nothing to set up. Copy a message to send it to the
 * developer, then mark it resolved once fixed. If it happens again it comes back as new.
 */

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from './auth-context';
import type { SiteErrorSource, SiteErrorStatus } from '@/lib/site-errors-core.mjs';

type Item = { id: string; source: SiteErrorSource; message: string; page_path: string | null; occurrences: number; first_seen_at: string; last_seen_at: string; status: SiteErrorStatus };
type Data = { available: boolean; items: Item[]; counts: Record<SiteErrorStatus, number> };

const FILTERS: { value: SiteErrorStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'resolved', label: 'Resolved' },
];
const when = (iso: string) => new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function SiteErrorsInbox() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<SiteErrorStatus>('new');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setData(null);
    try {
      const response = await fetch(`/api/admin/site-errors?status=${filter}`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) { setError(body?.error?.message || 'Could not load the site errors.'); return; }
      setData(body.data as Data);
    } catch {
      setError('Could not reach the server.');
    }
  }, [token, filter]);
  useEffect(() => { void load(); }, [load]);

  const mark = async (ids: string[], status: SiteErrorStatus) => {
    if (!token || working || ids.length === 0) return;
    setWorking(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/site-errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ ids, status }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setNotice(body?.error?.message || 'Not saved.'); return; }
      await load();
    } catch {
      setNotice('Could not reach the server. Try again.');
    } finally {
      setWorking(false);
    }
  };

  const copy = async (item: Item) => {
    const text = `BiteSite site error (${item.source}, seen ${item.occurrences}x, last ${item.last_seen_at})${item.page_path ? ` on ${item.page_path}` : ''}:\n${item.message}`;
    try { await navigator.clipboard.writeText(text); setNotice('Copied. Paste it to the developer.'); } catch { setNotice('Could not copy. Select the text and copy it by hand.'); }
  };

  const items = data?.items ?? [];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Site Errors</h2>
        <p className="mt-1 text-sm text-slate-400">When something breaks on the website, it shows up here by itself. Similar errors are grouped, with how many times they happened. Copy one to send to the developer; mark it resolved once fixed. If it happens again it comes back as new.</p>
      </div>
      {data && !data.available && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Not switched on yet: it starts after the database update for site errors is run.</p>
      )}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Error status">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} onClick={() => setFilter(f.value)}
            className={`min-h-11 rounded-lg px-4 text-sm ${filter === f.value ? 'bg-amber-500 font-medium text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
            {f.label}{data ? ` (${data.counts[f.value]})` : ''}
          </button>
        ))}
        {filter === 'new' && items.length > 1 && (
          <button type="button" disabled={working} onClick={() => void mark(items.map((i) => i.id), 'resolved')}
            className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 disabled:opacity-50 sm:ml-auto">Mark all {items.length} resolved</button>
        )}
      </div>
      {notice && <p className="text-sm text-slate-300" role="status">{notice}</p>}
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!data && !error && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
      {data?.available && items.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" /> {filter === 'new' ? 'No new errors. The website is running smoothly.' : 'Nothing resolved yet.'}</p>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium ${item.source === 'server' ? 'bg-red-500/15 text-red-300' : 'bg-sky-500/15 text-sky-300'}`}>{item.source === 'server' ? 'Server' : "Visitor's browser"}</span>
            <span className="text-slate-300">{item.occurrences === 1 ? 'Once' : `${item.occurrences.toLocaleString()} times`}</span>
            <span className="text-slate-500">Last {when(item.last_seen_at)}{item.occurrences > 1 ? ` · first ${when(item.first_seen_at)}` : ''}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words font-mono text-sm text-slate-100">{item.message}</p>
          {item.page_path && (
            <a href={item.page_path} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 break-all text-sm text-amber-300 underline">
              {item.page_path} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy(item)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm text-slate-200"><Copy className="h-4 w-4" /> Copy</button>
            {item.status === 'new'
              ? <button type="button" disabled={working} onClick={() => void mark([item.id], 'resolved')} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-950 disabled:opacity-50">Mark resolved</button>
              : <button type="button" disabled={working} onClick={() => void mark([item.id], 'new')} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 disabled:opacity-50">Reopen</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
