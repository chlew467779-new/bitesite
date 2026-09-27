/* bitesite/app/admin/components/feedback-inbox.tsx */
'use client';

/**
 * Feedback page: what restaurants sent from their dashboard (SYNC-052), newest first. Filter by
 * status; mark read or resolved and optionally reply — the Owner sees the reply on the dashboard.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './auth-context';
import { FEEDBACK_REPLY_LIMIT, FEEDBACK_TOPICS, type FeedbackQueueItem, type FeedbackStatus } from '@/lib/merchant-feedback-core.mjs';

type Counts = Record<FeedbackStatus, number>;
const FILTERS: { value: FeedbackStatus | null; label: string }[] = [
  { value: 'new', label: 'New' }, { value: 'read', label: 'Read' }, { value: 'resolved', label: 'Resolved' }, { value: null, label: 'All' },
];
const topicLabel = (value: string) => FEEDBACK_TOPICS.find((t) => t.value === value)?.label ?? value;

export default function FeedbackInbox() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<FeedbackStatus | null>('new');
  const [items, setItems] = useState<FeedbackQueueItem[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [itemError, setItemError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const response = await fetch(`/api/admin/feedback${filter ? `?status=${filter}` : ''}`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setError(data?.error?.message || 'Could not load the feedback.'); return; }
      setItems(data.data.items as FeedbackQueueItem[]);
      setCounts(data.data.counts as Counts);
    } catch {
      setError('Could not reach the server.');
    }
  }, [token, filter]);

  useEffect(() => { void load(); }, [load]);

  const update = async (item: FeedbackQueueItem, status: FeedbackStatus) => {
    if (!token || working) return;
    setWorking(item.id);
    setItemError((e) => ({ ...e, [item.id]: '' }));
    try {
      const reply = (replies[item.id] ?? item.reply ?? '').trim();
      const response = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: item.id, status, reply: reply || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) { setItemError((e) => ({ ...e, [item.id]: data?.error?.message || 'Not saved. Try again.' })); return; }
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
        <h2 className="text-xl font-semibold text-slate-100">Feedback</h2>
        <p className="text-sm text-slate-400">What restaurants sent from their dashboard. A reply is shown to the restaurant.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter feedback">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}
            className={`min-h-10 rounded-lg px-3 text-sm font-medium ${filter === f.value ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
            {f.label}{f.value && counts ? ` (${counts[f.value]})` : ''}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!items && !error && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
      {items && items.length === 0 && <p className="text-sm text-slate-400">Nothing here.</p>}
      {items?.map((item) => (
        <div key={item.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">{item.merchantName} <span className="text-sm font-normal text-[#6B6560]">/{item.slug}</span></p>
            <p className="text-xs text-[#6B6560]">{topicLabel(item.topic)} · {new Date(item.createdAt).toLocaleString()} · {item.status}</p>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.message}</p>
          <label className="mt-3 block text-sm">Reply to the restaurant (optional)
            <textarea rows={2} maxLength={FEEDBACK_REPLY_LIMIT} value={replies[item.id] ?? item.reply ?? ''}
              onChange={(event) => setReplies((r) => ({ ...r, [item.id]: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.status !== 'read' && <button type="button" disabled={working !== null} onClick={() => void update(item, 'read')} className="inline-flex min-h-10 items-center rounded-lg border border-[#2C3E2D] px-4 text-sm font-medium disabled:opacity-50">Mark read</button>}
            {item.status !== 'resolved' && <button type="button" disabled={working !== null} onClick={() => void update(item, 'resolved')} className="inline-flex min-h-10 items-center rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50">Resolve{(replies[item.id] ?? '').trim() ? ' and reply' : ''}</button>}
            {item.status === 'resolved' && <button type="button" disabled={working !== null} onClick={() => void update(item, 'resolved')} className="inline-flex min-h-10 items-center rounded-lg border border-[#2C3E2D] px-4 text-sm font-medium disabled:opacity-50">Save reply</button>}
          </div>
          {itemError[item.id] && <p className="mt-2 text-sm text-red-700" role="alert">{itemError[item.id]}</p>}
        </div>
      ))}
    </div>
  );
}
