/* bitesite/app/admin/components/feedback-inbox.tsx */
'use client';

/**
 * Feedback page (CH 2026-09-29). Two kinds, kept apart:
 *   Problems  handled as they come in (merchant "problem"/"listing", visitor "problem").
 *   Ideas     new features and design comments, collected and handled in a batch every two months.
 * Each kind shows what restaurants sent from their dashboard (with an optional reply the restaurant
 * sees) and what visitors sent from the footer's Feedback page. Waiting items are oldest first and
 * can be marked done several at a time. Restaurant feedback marked "read" earlier still counts as
 * waiting; only "resolved" is finished.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from './auth-context';
import { FEEDBACK_REPLY_LIMIT, FEEDBACK_TOPICS, type FeedbackQueueItem, type FeedbackStatus } from '@/lib/merchant-feedback-core.mjs';
import { SITE_FEEDBACK_TOPICS, daysWaiting, isUrgentMerchantTopic, isUrgentSiteTopic } from '@/lib/site-feedback-core.mjs';

type Kind = 'problems' | 'ideas';
type Source = 'restaurants' | 'visitors';
type VisitorItem = { id: string; topic: string; message: string; page_path: string | null; contact_email: string | null; status: 'new' | 'done'; created_at: string };

const merchantTopic = (value: string) => FEEDBACK_TOPICS.find((t) => t.value === value)?.label ?? value;
const visitorTopic = (value: string) => SITE_FEEDBACK_TOPICS.find((t) => t.value === value)?.label ?? value;
const ageText = (iso: string) => {
  const days = daysWaiting(iso) ?? 0;
  return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
};
const pill = (active: boolean) => `min-h-11 rounded-lg px-4 text-sm font-medium ${active ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`;
/** Waiting: oldest first, so a batch is worked through in order. Finished: newest first. */
const byAge = <T,>(list: T[], date: (item: T) => string, finished: boolean) =>
  [...list].sort((a, b) => (finished ? date(b).localeCompare(date(a)) : date(a).localeCompare(date(b))));

export default function FeedbackInbox() {
  const { token } = useAuth();
  const [kind, setKind] = useState<Kind>('problems');
  const [source, setSource] = useState<Source>('restaurants');
  const [showDone, setShowDone] = useState(false);
  const [merchantItems, setMerchantItems] = useState<FeedbackQueueItem[] | null>(null);
  const [visitorItems, setVisitorItems] = useState<VisitorItem[] | null>(null);
  const [visitorUnavailable, setVisitorUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [itemError, setItemError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    const headers = { 'x-admin-token': token };
    const get = async (url: string) => {
      const r = await fetch(url, { headers, cache: 'no-store' });
      return { ok: r.ok, body: await r.json().catch(() => null) };
    };
    try {
      const [m, v] = await Promise.all([
        get('/api/admin/feedback'),
        get(`/api/admin/site-feedback?status=${showDone ? 'done' : 'new'}`),
      ]);
      if (!m.ok || !m.body?.data) { setError(m.body?.error?.message || 'Could not load the feedback.'); return; }
      const all = m.body.data.items as FeedbackQueueItem[];
      setMerchantItems(all.filter((i) => (i.status === 'resolved') === showDone));
      setVisitorUnavailable(!v.ok);
      setVisitorItems(v.ok ? (v.body?.data?.items as VisitorItem[]) ?? [] : []);
      setSelected(new Set());
    } catch {
      setError('Could not reach the server.');
    }
  }, [token, showDone]);
  useEffect(() => { void load(); }, [load]);

  const restaurants = useMemo(
    () => byAge((merchantItems ?? []).filter((i) => isUrgentMerchantTopic(i.topic) === (kind === 'problems')), (i) => i.createdAt, showDone),
    [merchantItems, kind, showDone],
  );
  const visitors = useMemo(
    () => byAge((visitorItems ?? []).filter((i) => isUrgentSiteTopic(i.topic) === (kind === 'problems')), (i) => i.created_at, showDone),
    [visitorItems, kind, showDone],
  );
  const count = (k: Kind) => {
    const urgent = k === 'problems';
    return (merchantItems ?? []).filter((i) => isUrgentMerchantTopic(i.topic) === urgent).length
      + (visitorItems ?? []).filter((i) => isUrgentSiteTopic(i.topic) === urgent).length;
  };
  const visible = source === 'restaurants' ? restaurants : visitors;
  const toggle = (id: string) => setSelected((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const patchMerchant = async (id: string, status: FeedbackStatus, reply: string | null) => {
    const response = await fetch('/api/admin/feedback', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': token ?? '' },
      body: JSON.stringify({ id, status, reply }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || 'Not saved. Try again.');
  };
  const markDone = async (ids: string[]) => {
    if (!token || working || ids.length === 0) return;
    setWorking(true); setError('');
    try {
      if (source === 'visitors') {
        const response = await fetch('/api/admin/site-feedback', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ ids, status: showDone ? 'new' : 'done' }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error?.message || 'Not saved. Try again.');
      } else {
        // One at a time so a reply typed for an item is sent with it.
        for (const id of ids) {
          const item = restaurants.find((i) => i.id === id);
          await patchMerchant(id, showDone ? 'new' : 'resolved', (replies[id] ?? item?.reply ?? '').trim() || null);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Not saved. Try again.');
    } finally {
      await load();
      setWorking(false);
    }
  };
  const saveReply = async (item: FeedbackQueueItem) => {
    if (!token || working) return;
    setWorking(true);
    setItemError((e) => ({ ...e, [item.id]: '' }));
    try { await patchMerchant(item.id, item.status, (replies[item.id] ?? '').trim() || null); await load(); }
    catch (caught) { setItemError((e) => ({ ...e, [item.id]: caught instanceof Error ? caught.message : 'Not saved.' })); }
    finally { setWorking(false); }
  };

  const doneLabel = showDone ? 'Move back to waiting' : kind === 'problems' ? 'Mark solved' : 'Mark done';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Feedback</h2>
        <p className="text-sm text-slate-400">Problems are handled as they come in. Ideas and design comments are saved for a batch.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Kind of feedback">
        {(['problems', 'ideas'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setSelected(new Set()); }}
            className={`rounded-xl border p-4 text-left transition-colors ${kind === k ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-900 hover:bg-slate-800/60'}`}>
            <p className="text-sm font-semibold text-white">{k === 'problems' ? 'Problems' : 'Ideas and design'} <span className="tabular-nums text-amber-300">{merchantItems ? count(k) : '…'}</span></p>
            <p className="text-xs text-slate-400">{k === 'problems' ? 'Something is wrong: handle now' : 'New features and layout comments: handle in a batch'}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sent by">
          <button type="button" aria-pressed={source === 'restaurants'} onClick={() => { setSource('restaurants'); setSelected(new Set()); }} className={pill(source === 'restaurants')}>From restaurants ({restaurants.length})</button>
          <button type="button" aria-pressed={source === 'visitors'} onClick={() => { setSource('visitors'); setSelected(new Set()); }} className={pill(source === 'visitors')}>From visitors ({visitors.length})</button>
        </div>
        <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" className="h-5 w-5" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show finished
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {source === 'visitors' && visitorUnavailable && <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Visitor feedback is not set up in the database yet.</p>}
      {!merchantItems && !error && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}

      {visible.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur">
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" className="h-5 w-5" checked={selected.size === visible.length} onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((i) => i.id)) : new Set())} />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>
          <button type="button" disabled={working || selected.size === 0} onClick={() => void markDone([...selected])} className="ml-auto min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-950 disabled:opacity-40">
            {working ? 'Saving…' : `${doneLabel}${selected.size > 1 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      )}

      {merchantItems && visible.length === 0 && !(source === 'visitors' && visitorUnavailable) && (
        <p className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-6 text-center text-sm text-slate-400">
          {showDone ? 'Nothing finished here yet.' : kind === 'problems' ? 'No problems waiting. All clear.' : 'No ideas saved yet.'}
        </p>
      )}

      <ul className="space-y-3">
        {source === 'restaurants' && restaurants.map((item) => (
          <li key={item.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
            <div className="flex items-start gap-3">
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" aria-label={`Select feedback from ${item.merchantName}`} className="h-5 w-5" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /></label>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{item.merchantName} <span className="text-sm font-normal text-[#6B6560]">/{item.slug}</span></p>
                  <p className="text-xs text-[#6B6560]">{merchantTopic(item.topic)} · {ageText(item.createdAt)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.message}</p>
                <label className="mt-3 block text-sm">Reply to the restaurant (optional; shown on their dashboard)
                  <textarea rows={2} maxLength={FEEDBACK_REPLY_LIMIT} value={replies[item.id] ?? item.reply ?? ''}
                    onChange={(event) => setReplies((r) => ({ ...r, [item.id]: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm" />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={working} onClick={() => void markDone([item.id])} className="inline-flex min-h-11 items-center rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50">
                    {doneLabel}{!showDone && (replies[item.id] ?? '').trim() ? ' and send reply' : ''}
                  </button>
                  {replies[item.id] !== undefined && replies[item.id].trim() !== (item.reply ?? '') && (
                    <button type="button" disabled={working} onClick={() => void saveReply(item)} className="inline-flex min-h-11 items-center rounded-lg border border-[#2C3E2D] px-4 text-sm font-medium disabled:opacity-50">Send reply only</button>
                  )}
                </div>
                {itemError[item.id] && <p className="mt-2 text-sm text-red-700" role="alert">{itemError[item.id]}</p>}
              </div>
            </div>
          </li>
        ))}

        {source === 'visitors' && visitors.map((item) => (
          <li key={item.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
            <div className="flex items-start gap-3">
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" aria-label="Select this visitor feedback" className="h-5 w-5" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /></label>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{visitorTopic(item.topic)}</p>
                  <p className="text-xs text-[#6B6560]">{ageText(item.created_at)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.message}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B6560]">
                  {item.page_path && <a href={item.page_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Sent from {item.page_path} <ExternalLink className="h-3 w-3" /></a>}
                  {item.contact_email && <a href={`mailto:${item.contact_email}`} className="underline">{item.contact_email}</a>}
                </div>
                <button type="button" disabled={working} onClick={() => void markDone([item.id])} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50">{doneLabel}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
