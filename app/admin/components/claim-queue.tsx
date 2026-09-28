/* bitesite/app/admin/components/claim-queue.tsx */
'use client';

/**
 * Restaurant Claims page: people asking to manage an existing restaurant, oldest first. Check the
 * evidence against the restaurant's listed contact details (call the listed phone when unsure)
 * before approving; approval makes the claimant the Owner and closes competing claims. Reject
 * needs a note the claimant receives. Retries reuse the same request id.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { useAuth } from './auth-context';
import type { ClaimQueueItem } from '@/lib/merchant-claim-core.mjs';

export default function ClaimQueue() {
  const { token } = useAuth();
  const [items, setItems] = useState<ClaimQueueItem[] | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [itemError, setItemError] = useState<Record<string, string>>({});
  const unknown = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const response = await fetch('/api/admin/claims', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) { setError(data?.error?.message || 'Could not load the claims.'); return; }
      setItems(data.data as ClaimQueueItem[]);
    } catch {
      setError('Could not reach the server.');
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: ClaimQueueItem, decision: 'approve' | 'reject') => {
    if (!token || working) return;
    const note = (notes[item.id] ?? '').trim();
    if (decision === 'reject' && !note) { setItemError((e) => ({ ...e, [item.id]: 'Write a note for the claimant first.' })); return; }
    if (decision === 'approve' && !window.confirm(`Make ${item.userEmail ?? 'this account'} the Owner of ${item.restaurant.name}?`)) return;
    const key = `${item.id}:${decision}:${note}`;
    const requestId = unknown.current[key] ?? crypto.randomUUID();
    setWorking(item.id);
    setItemError((e) => ({ ...e, [item.id]: '' }));
    try {
      const response = await fetch('/api/admin/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ requestId, claimId: item.id, decision, note: note || null }),
      });
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        unknown.current[key] = requestId;
        setItemError((e) => ({ ...e, [item.id]: 'Not confirmed. Click again to retry the same decision.' }));
        return;
      }
      delete unknown.current[key];
      if (!response.ok) { setItemError((e) => ({ ...e, [item.id]: data.error?.message || 'Not saved.' })); return; }
      // Approval also closes competing claims for the same restaurant.
      if (decision === 'approve') await load();
      else setItems((list) => (list ? list.filter((x) => x.id !== item.id) : list));
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
        <h2 className="text-xl font-semibold text-slate-100">Restaurant Claims</h2>
        <p className="text-sm text-slate-400">People asking to manage a restaurant that is already on BiteSite. Check their evidence against the restaurant&apos;s listed details, for example by calling the listed phone, before approving.</p>
      </div>
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!items && !error && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
      {items && items.length === 0 && <p className="text-sm text-slate-400">No claims are waiting.</p>}
      {items?.map((item) => (
        <div key={item.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">
              <a href={`/store/${encodeURIComponent(item.restaurant.slug)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">{item.restaurant.name} <ExternalLink className="h-3 w-3" /></a>
            </p>
            <p className="text-xs text-[#6B6560]">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-[#F2F5F0] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6560]">Claimant</p>
              <p className="mt-1 break-words">{item.contactName} · {item.relationship === 'owner' ? 'Owner' : 'Manager'}</p>
              <p className="break-words">{item.userEmail ?? 'Unknown email'}{item.emailDomainMatch && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900">email matches website domain</span>}</p>
              <p><a href={`tel:${item.contactPhone.replace(/[^0-9+]/g, '')}`} className="underline">{item.contactPhone}</a></p>
              <p className="mt-2 whitespace-pre-wrap break-words">{item.evidence}</p>
            </div>
            <div className="rounded-lg border border-[#EEF2EC] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6560]">Listed on BiteSite</p>
              <p className="mt-1">Phone: {item.restaurant.phone ? <a href={`tel:${item.restaurant.phone.replace(/[^0-9+]/g, '')}`} className="underline">{item.restaurant.phone}</a> : '—'}</p>
              <p>WhatsApp: {item.restaurant.whatsapp ?? '—'}</p>
              <p className="break-words">Email: {item.restaurant.email ?? '—'}</p>
              <p className="break-words">Website: {item.restaurant.website ?? '—'}</p>
              <p className="break-words">Address: {[item.restaurant.address, item.restaurant.area].filter(Boolean).join(', ') || '—'}</p>
            </div>
          </div>
          {item.ownerExists && <p className="mt-2 text-xs text-amber-800">This restaurant already has an active Owner, so approving will be refused.</p>}
          {item.otherPending > 0 && <p className="mt-2 text-xs text-amber-800">{item.otherPending} other claim{item.otherPending > 1 ? 's' : ''} for this restaurant {item.otherPending > 1 ? 'are' : 'is'} waiting. Approving this one closes the others.</p>}
          <label className="mt-3 block text-sm">Note for the claimant (needed to reject)
            <textarea rows={2} maxLength={1000} value={notes[item.id] ?? ''} onChange={(event) => setNotes((n) => ({ ...n, [item.id]: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={working !== null} onClick={() => void decide(item, 'approve')} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="h-4 w-4" /> Approve</button>
            <button type="button" disabled={working !== null} onClick={() => void decide(item, 'reject')} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-700 px-4 text-sm font-medium text-red-700 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button>
          </div>
          {itemError[item.id] && <p className="mt-2 text-sm text-red-700" role="alert">{itemError[item.id]}</p>}
        </div>
      ))}
    </div>
  );
}
