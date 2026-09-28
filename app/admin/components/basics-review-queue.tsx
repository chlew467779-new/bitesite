/* bitesite/app/admin/components/basics-review-queue.tsx */
'use client';

/**
 * Owner requests to change the restaurant name, address/area or cuisine after approval, oldest
 * first. Approve applies every requested detail at once, only if none changed since the Owner
 * asked; Reject needs a note, which the Owner sees. Each decision has its own request id and is
 * retried with the same id when the result is unknown. The slug and map pin are not changed here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useAuth } from './auth-context';
import type { BasicsQueueItem, BasicsValues } from '@/lib/merchant-basics-core.mjs';

function rows(item: BasicsQueueItem) {
  const { current: now, changes } = item;
  const out: { label: string; now: string; requested: string }[] = [];
  if (changes.name != null) out.push({ label: 'Name', now: now.name ?? '—', requested: changes.name });
  if (changes.address != null) {
    const place = (v: Partial<BasicsValues>) => [v.address, v.area].filter(Boolean).join(' · ') || '—';
    out.push({ label: 'Address', now: place(now), requested: place(changes) });
  }
  if (changes.cuisine) out.push({ label: 'Cuisine', now: now.cuisine.join(', ') || '—', requested: changes.cuisine.join(', ') });
  return out;
}

export default function BasicsReviewQueue({ searchQuery = '' }: { searchQuery?: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<BasicsQueueItem[] | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [itemError, setItemError] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, string>>({});
  const unknown = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const response = await fetch('/api/admin/basics-reviews', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) { setError(data?.error?.message || 'Could not load the change requests.'); return; }
      setItems(data.data as BasicsQueueItem[]);
    } catch {
      setError('Could not reach the server.');
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const query = searchQuery.trim().toLocaleLowerCase();
  const visibleItems = items?.filter((item) =>
    item.merchantName.toLocaleLowerCase().includes(query) || item.slug.toLocaleLowerCase().includes(query));

  const decide = async (item: BasicsQueueItem, decision: 'approve' | 'reject') => {
    if (!token || working) return;
    const note = (notes[item.id] ?? '').trim();
    if (decision === 'reject' && !note) { setItemError((e) => ({ ...e, [item.id]: 'Write a note for the restaurant first.' })); return; }
    const key = `${item.id}:${decision}:${note}`;
    const requestId = unknown.current[key] ?? crypto.randomUUID();
    setWorking(item.id);
    setItemError((e) => ({ ...e, [item.id]: '' }));
    try {
      const response = await fetch('/api/admin/basics-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ requestId, basicsRequestId: item.id, decision, note: note || null }),
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
      if (decision === 'approve' && item.changes.address != null) {
        setDone((d) => ({ ...d, [item.id]: `${item.merchantName}: address changed. Check the map pin in Merchant Manager.` }));
      }
    } catch {
      unknown.current[key] = requestId;
      setItemError((e) => ({ ...e, [item.id]: 'Could not reach the server. Click again to retry the same decision.' }));
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Name, address & cuisine</h3>
        <p className="text-sm text-slate-400">Approved restaurants ask to change these here. Nothing changes on their page until you approve. The web address (slug) and map pin stay as they are.</p>
      </div>
      {Object.entries(done).map(([id, text]) => <p key={id} className="rounded-lg bg-amber-950/40 px-4 py-3 text-sm text-amber-200" role="status">{text}</p>)}
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!items && !error && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
      {items && items.length === 0 && <p className="text-sm text-slate-400">No name, address or cuisine requests are waiting.</p>}
      {items && items.length > 0 && visibleItems?.length === 0 && <p className="text-sm text-slate-400">No name, address or cuisine requests match this restaurant.</p>}
      {visibleItems?.map((item) => (
        <div key={item.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">{item.merchantName} <span className="text-sm font-normal text-[#6B6560]">/{item.slug}</span></p>
            <p className="text-xs text-[#6B6560]">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
          <dl className="mt-2 space-y-2 text-sm">
            {rows(item).map((row) => (
              <div key={row.label}>
                <dt className="font-medium">{row.label}</dt>
                <dd className="break-words"><span className="text-[#6B6560]">Now: </span>{row.now}</dd>
                <dd className="break-words"><span className="text-[#6B6560]">Requested: </span><strong>{row.requested}</strong></dd>
              </div>
            ))}
          </dl>
          {item.changedSinceRequest && <p className="mt-2 text-xs text-amber-800">These details changed after this request was sent, so approving will be refused.</p>}
          <label className="mt-3 block text-sm">Note for the restaurant (needed to reject)
            <textarea rows={2} maxLength={500} value={notes[item.id] ?? ''} onChange={(event) => setNotes((n) => ({ ...n, [item.id]: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={working !== null} onClick={() => void decide(item, 'approve')} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="h-4 w-4" /> Approve</button>
            <button type="button" disabled={working !== null} onClick={() => void decide(item, 'reject')} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-700 px-4 text-sm font-medium text-red-700 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button>
          </div>
          {itemError[item.id] && <p className="mt-2 text-sm text-red-700" role="alert">{itemError[item.id]}</p>}
        </div>
      ))}
    </section>
  );
}
