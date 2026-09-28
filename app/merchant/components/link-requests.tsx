/* bitesite/app/merchant/components/link-requests.tsx */
'use client';

/**
 * Owner links (website, Instagram, Facebook, menu PDF, GrabFood). A change is a request that the
 * BiteSite team reviews before it appears on the page; one request per link can wait at a time
 * (a new one replaces it), and a waiting request can be withdrawn. Mobile first: one card per
 * link, full-width buttons, URL keyboard. Checks mirror the server (lib/merchant-links-core.mjs).
 */

import type { SectionHandle } from '@/app/components/section-save/use-section-save';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LINK_FIELDS, LINK_PROBLEM_TEXT, linkProblem, type LinkField, type LinkRequestItem } from '@/lib/merchant-links-core.mjs';

type Links = Record<LinkField, string | null>;
type Pending = { requestId: string; body: Record<string, unknown>; success: string };

const btn = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50';
const input = 'mt-1 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-3 text-base text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

function safeHref(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null; } catch { return null; }
}

export function LinkRequests({ merchantId, getHeaders, readOnly, register }: {
  merchantId: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  readOnly: boolean;
  register?: (id: string, handle: SectionHandle | null) => void;
}) {
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/links`;
  const [links, setLinks] = useState<Links | null>(null);
  const [requests, setRequests] = useState<LinkRequestItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<{ field: LinkField; value: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    register?.('links', { status: () => ({ dirty: !!editing, pending: busy, unknown: !!unknown, conflicts: false }), save: async () => 'skipped', discard: () => { setEditing(null); } });
    return () => register?.('links', null);
  }, [register, busy, unknown, editing]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const headers = await getHeaders();
      if (!headers) { setLoadError('Your session has ended. Sign in again.'); return; }
      const response = await fetch(api, { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setLoadError(data?.error?.message || data?.error || 'Could not load your links.'); return; }
      setLinks(data.data.links as Links);
      setRequests(data.data.requests as LinkRequestItem[]);
    } catch {
      setLoadError('Could not reach BiteSite. Check your connection.');
    }
  }, [api, getHeaders]);

  useEffect(() => { void load(); }, [load]);

  const send = async (pending: Pending) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: 'Your session has ended. Sign in again, then retry.' }); return false; }
      let response: Response;
      try {
        response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: pending.requestId, ...pending.body }) });
      } catch {
        setUnknown(pending);
        setMessage({ kind: 'error', text: 'Could not reach BiteSite. Retry sends the same request, so it is never sent twice.' });
        return false;
      }
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        setUnknown(pending);
        setMessage({ kind: 'error', text: 'The result is not confirmed. Retry sends the same request, so it is never sent twice.' });
        return false;
      }
      setUnknown(null);
      if (!response.ok) { setMessage({ kind: 'error', text: data.error?.message || 'The request was not sent.' }); return false; }
      setMessage({ kind: 'ok', text: data.data?.status === 'noop' ? 'That is already your current link.' : pending.success });
      await load();
      return true;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (loadError) return <p className="text-sm text-red-700" role="alert">{loadError} <button type="button" className="ml-1 min-h-11 underline" onClick={() => void load()}>Try again</button></p>;
  if (!links) return <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />;

  const locked = readOnly || busy || !!unknown;
  const submit = async (field: LinkField, value: string) => {
    const problem = linkProblem(field, value);
    if (problem) { setFormError(LINK_PROBLEM_TEXT[problem]); return; }
    const url = value.trim() || null;
    if (await send({ requestId: crypto.randomUUID(), body: { action: 'request', field, url }, success: url ? 'Sent. BiteSite will check the link before it appears on your page.' : 'Sent. BiteSite will remove the link after checking.' })) setEditing(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#6B6560]">Links are checked by the BiteSite team before they appear on your page. Your current links stay until a change is approved.</p>
      {LINK_FIELDS.map(({ field, label, placeholder }) => {
        const current = links[field];
        const pending = requests.find((r) => r.field === field && r.status === 'pending');
        const rejected = requests.find((r) => r.field === field && r.status === 'rejected' && !pending);
        const href = safeHref(current);
        return (
          <div key={field} className="rounded-xl border border-[#DDE5DC] p-3">
            <p className="text-sm font-medium text-[#2C3E2D]">{label}</p>
            <p className="mt-1 break-all text-sm text-[#2C3E2D]">
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{current}</a> : <span className="text-[#6B6560]">Not set</span>}
            </p>
            {pending && (
              <div className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                <p>Waiting for review: {pending.proposedUrl ? <span className="break-all">{pending.proposedUrl}</span> : 'remove this link'}</p>
                <button type="button" disabled={locked} onClick={() => void send({ requestId: crypto.randomUUID(), body: { action: 'withdraw', linkRequestId: pending.id }, success: 'Request withdrawn.' })}
                  className={`${btn} mt-2 w-full border border-amber-800 sm:w-auto`}>Withdraw request</button>
              </div>
            )}
            {rejected && <p className="mt-2 text-sm text-red-700">Not approved: {rejected.reviewNote}</p>}
            {editing?.field === field ? (
              <form className="mt-2 space-y-2" onSubmit={(event) => { event.preventDefault(); void submit(field, editing.value); }}>
                <label className="block text-sm">New link
                  <input className={input} type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder={placeholder} value={editing.value}
                    onChange={(event) => { setEditing({ field, value: event.target.value }); setFormError(''); }} autoFocus />
                </label>
                {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="submit" disabled={locked || !editing.value.trim()} className={`${btn} bg-[#2C3E2D] text-white`}>Send for review</button>
                  {current && <button type="button" disabled={locked} onClick={() => void submit(field, '')} className={`${btn} border border-red-700 text-red-700`}>Ask to remove this link</button>}
                  <button type="button" onClick={() => setEditing(null)} className={`${btn} border border-[#C9D6C7]`}>Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" disabled={locked} onClick={() => { setEditing({ field, value: pending?.proposedUrl ?? current ?? '' }); setFormError(''); }}
                className={`${btn} mt-2 w-full border border-[#2C3E2D] text-[#2C3E2D] sm:w-auto`}>{pending ? 'Change request' : 'Request a change'}</button>
            )}
          </div>
        );
      })}
      {unknown && <button type="button" disabled={busy} onClick={() => void send(unknown)} className={`${btn} w-full border border-[#2C3E2D] sm:w-auto`}>{busy ? 'Retrying…' : 'Retry'}</button>}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
