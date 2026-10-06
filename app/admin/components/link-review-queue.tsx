/* bitesite/app/admin/components/link-review-queue.tsx */
'use client';

/**
 * Links part of the Change Requests page: every waiting Owner link request, oldest first. Approve applies the link only
 * if it has not changed since the Owner asked; Reject needs a note, which the Owner sees. Each
 * decision has its own request id and is retried with the same id when the result is unknown.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { useAuth } from './auth-context';
import NotifyMerchant, { type Notice } from './notify-merchant';
import { LINK_FIELDS, LINK_PROBLEM_TEXT, linkProblem, type LinkQueueItem } from '@/lib/merchant-links-core.mjs';

const LABEL = Object.fromEntries(LINK_FIELDS.map((f) => [f.field, f.label]));

function safeHref(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null; } catch { return null; }
}

export default function LinkReviewQueue({ searchQuery = '' }: { searchQuery?: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<LinkQueueItem[] | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [itemError, setItemError] = useState<Record<string, string>>({});
  // One-tap WhatsApp/email notice for each decision made here (CH 2026-09-30).
  const [notices, setNotices] = useState<Notice[]>([]);
  const addNotice = (notice: Notice) => setNotices((list) => [notice, ...list.filter((n) => n.key !== notice.key)]);
  const unknown = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const response = await fetch('/api/admin/link-reviews', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) { setError(data?.error?.message || 'Could not load the link requests.'); return; }
      setItems(data.data as LinkQueueItem[]);
    } catch {
      setError('Could not reach the server.');
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const query = searchQuery.trim().toLocaleLowerCase();
  const visibleItems = items?.filter((item) =>
    item.merchantName.toLocaleLowerCase().includes(query) || item.slug.toLocaleLowerCase().includes(query));

  const decide = async (item: LinkQueueItem, decision: 'approve' | 'reject') => {
    if (!token || working) return;
    const note = (notes[item.id] ?? '').trim();
    if (decision === 'reject' && !note) { setItemError((e) => ({ ...e, [item.id]: 'Write a note for the restaurant first.' })); return; }
    const key = `${item.id}:${decision}:${note}`;
    const requestId = unknown.current[key] ?? crypto.randomUUID();
    setWorking(item.id);
    setItemError((e) => ({ ...e, [item.id]: '' }));
    try {
      const response = await fetch('/api/admin/link-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ requestId, linkRequestId: item.id, decision, note: note || null }),
      });
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        unknown.current[key] = requestId;
        setItemError((e) => ({ ...e, [item.id]: 'Not confirmed. Click again to retry the same decision.' }));
        return;
      }
      delete unknown.current[key];
      if (!response.ok) { setItemError((e) => ({ ...e, [item.id]: data.error?.message || 'Not saved.' })); return; }
      setItems((list) => (list ? list.filter((x) => x.id !== item.id) : list));
      addNotice({ key: item.id, merchantId: item.merchantId, kind: decision === 'approve' ? 'link_approved' : 'link_rejected', note: note || null, label: `${item.merchantName}: link ${decision === 'approve' ? 'approved' : 'rejected'}` });
    } catch {
      unknown.current[key] = requestId;
      setItemError((e) => ({ ...e, [item.id]: 'Could not reach the server. Click again to retry the same decision.' }));
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Links</h3>
        <p className="text-sm text-slate-400">Restaurants ask for website, social, menu and delivery app (GrabFood, ShopeeFood, foodpanda) link changes here. Nothing appears on their page until you approve it.</p>
      </div>
      <NotifyMerchant notices={notices} onDone={(key) => setNotices((list) => list.filter((n) => n.key !== key))} />
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!items && !error && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
      {items && items.length === 0 && <p className="text-sm text-slate-400">No link requests are waiting.</p>}
      {items && items.length > 0 && visibleItems?.length === 0 && <p className="text-sm text-slate-400">No link requests match this restaurant.</p>}
      {visibleItems?.map((item) => {
        const proposed = safeHref(item.proposedUrl);
        const current = safeHref(item.currentUrl);
        return (
          <div key={item.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{item.merchantName} <span className="text-sm font-normal text-[#6B6560]">/{item.slug}</span></p>
              <p className="text-xs text-[#6B6560]">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-2 text-sm font-medium">{LABEL[item.field] ?? item.field}</p>
            <dl className="mt-1 grid gap-1 text-sm">
              <div><dt className="inline text-[#6B6560]">Now: </dt><dd className="inline break-all">{current ? <a href={current} target="_blank" rel="noopener noreferrer nofollow" className="underline">{item.currentUrl}</a> : 'Not set'}</dd></div>
              <div><dt className="inline text-[#6B6560]">Requested: </dt><dd className="inline break-all">{proposed ? <a href={proposed} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline">{item.proposedUrl} <ExternalLink className="h-3 w-3" /></a> : 'Remove the link'}</dd></div>
            </dl>
            {/* Requests sent before a check existed (e.g. a delivery app's home page, T2) are flagged here. */}
            {item.proposedUrl && linkProblem(item.field, item.proposedUrl) && <p className="mt-1 text-xs text-amber-800" role="note">Check this link: {LINK_PROBLEM_TEXT[linkProblem(item.field, item.proposedUrl)!]}</p>}
            {item.currentUrl !== item.baseValue && <p className="mt-1 text-xs text-amber-800">The link changed after this request was sent, so approving will be refused.</p>}
            <label className="mt-3 block text-sm">Note for the restaurant (needed to reject)
              <textarea rows={2} maxLength={500} value={notes[item.id] ?? ''} onChange={(event) => setNotes((n) => ({ ...n, [item.id]: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={working !== null} onClick={() => void decide(item, 'approve')} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="h-4 w-4" /> Approve</button>
              <button type="button" disabled={working !== null} onClick={() => void decide(item, 'reject')} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-red-700 px-4 text-sm font-medium text-red-700 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button>
            </div>
            {itemError[item.id] && <p className="mt-2 text-sm text-red-700" role="alert">{itemError[item.id]}</p>}
          </div>
        );
      })}
    </div>
  );
}
