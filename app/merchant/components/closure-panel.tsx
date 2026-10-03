'use client';

/**
 * Open / temporarily closed (Owner). Mobile first: one clear status, one button to switch, and when
 * closing an optional note ("Closed for Hari Raya") and expected reopening date that visitors see.
 * Moved / permanently closed are set by the BiteSite team. An unconfirmed result is retried with
 * the same request id.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CLOSURE_NOTE_LIMIT } from '@/lib/merchant-closure-core.mjs';

type Status = { businessStatus: string; note: string | null; reopenOn: string | null; ownerCanChange: boolean };
type Pending = { requestId: string; status: 'OPEN' | 'TEMPORARILY_CLOSED'; note: string | null; reopenOn: string | null };

const btn = 'inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50 sm:w-auto';
const input = 'mt-1 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-3 text-base text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

export function ClosurePanel({ merchantId, getHeaders, readOnly, onStatus }: { merchantId: string; getHeaders: () => Promise<Record<string, string> | null>; readOnly: boolean; onStatus?: (businessStatus: string) => void }) {
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/business-status`;
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState<{ note: string; reopenOn: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const unknown = useRef<Pending | null>(null);

  const load = useCallback(async () => {
    setError('');
    const headers = await getHeaders();
    if (!headers) { setError('Your session has ended. Sign in again.'); return; }
    const response = await fetch(api, { headers, cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.data) { setError(body?.error?.message || 'Could not load your opening status.'); return; }
    setStatus(body.data as Status);
    onStatus?.((body.data as Status).businessStatus);
  }, [api, getHeaders, onStatus]);

  useEffect(() => { void load(); }, [load]);

  const send = async (pending: Pending) => {
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: 'Your session has ended. Sign in again, then retry.' }); return; }
      const response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      const body = await response.json().catch(() => null);
      if (response.status >= 500 || !body) { unknown.current = pending; setMessage({ kind: 'error', text: 'Not confirmed. Retry sends the same request.' }); return; }
      unknown.current = null;
      if (!response.ok) { setMessage({ kind: 'error', text: body.error?.message || 'Not saved.' }); return; }
      setClosing(null);
      setMessage({ kind: 'ok', text: pending.status === 'OPEN' ? 'Your page shows you are open again.' : 'Your page now shows you are temporarily closed.' });
      await load();
    } catch {
      unknown.current = pending;
      setMessage({ kind: 'error', text: 'Could not reach BiteSite. Retry sends the same request.' });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-700" role="alert">{error} <button type="button" className="ml-1 min-h-11 underline" onClick={() => void load()}>Try again</button></p>;
  if (!status) return <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />;

  const closed = status.businessStatus === 'TEMPORARILY_CLOSED';
  const locked = readOnly || busy || !status.ownerCanChange;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3 text-[#2C3E2D]">
      <p className="text-sm">
        Now: <span className={`font-semibold ${closed ? 'text-amber-800' : 'text-emerald-800'}`}>{closed ? 'Temporarily closed' : status.businessStatus === 'OPEN' ? 'Open' : status.businessStatus.replaceAll('_', ' ').toLowerCase()}</span>
        {closed && status.reopenOn ? ` · back on ${status.reopenOn}` : ''}
      </p>
      {closed && status.note && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{status.note}</p>}
      {!status.ownerCanChange && <p className="text-sm text-[#6B6560]">This status is set by the BiteSite team. Contact us through Feedback to change it.</p>}

      {closing ? (
        <form className="space-y-3 rounded-xl border border-[#DDE5DC] p-3" onSubmit={(e) => { e.preventDefault(); void send(unknown.current ?? { requestId: crypto.randomUUID(), status: 'TEMPORARILY_CLOSED', note: closing.note.trim() || null, reopenOn: closing.reopenOn || null }); }}>
          <label className="block text-sm font-medium">Note for visitors (optional)
            <input className={input} maxLength={CLOSURE_NOTE_LIMIT} placeholder="e.g. Closed for Hari Raya, back soon!" value={closing.note}
              onChange={(e) => { unknown.current = null; setClosing({ ...closing, note: e.target.value }); }} />
          </label>
          <label className="block text-sm font-medium">Expected to reopen (optional)
            <input className={input} type="date" min={today} value={closing.reopenOn}
              onChange={(e) => { unknown.current = null; setClosing({ ...closing, reopenOn: e.target.value }); }} />
          </label>
          <p className="text-xs text-[#6B6560]">For example, choose the day you expect to welcome visitors again.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={locked} className={`${btn} bg-amber-700 text-white`}>{busy ? 'Saving…' : unknown.current ? 'Retry' : 'Mark temporarily closed'}</button>
            <button type="button" disabled={busy} onClick={() => { setClosing(null); unknown.current = null; }} className={`${btn} border border-[#C9D6C7]`}>Cancel</button>
          </div>
        </form>
      ) : closed ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={locked} onClick={() => void send(unknown.current ?? { requestId: crypto.randomUUID(), status: 'OPEN', note: null, reopenOn: null })} className={`${btn} bg-[#2C3E2D] text-white`}>{busy ? 'Saving…' : unknown.current ? 'Retry' : "We're open again"}</button>
          <button type="button" disabled={locked} onClick={() => setClosing({ note: status.note ?? '', reopenOn: status.reopenOn ?? '' })} className={`${btn} border border-[#2C3E2D]`}>Change note or date</button>
        </div>
      ) : (
        <button type="button" disabled={locked} onClick={() => setClosing({ note: '', reopenOn: '' })} className={`${btn} border border-amber-700 text-amber-800`}>Temporarily close</button>
      )}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
