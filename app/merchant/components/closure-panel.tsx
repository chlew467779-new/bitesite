'use client';

/**
 * Open / temporarily closed (Owner). Mobile first: one clear status, one button to switch, and when
 * closing an optional note ("Closed for Hari Raya") and expected reopening date that visitors see.
 * Moved / permanently closed are set by the BiteSite team. An unconfirmed result is retried with
 * the same request id.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { buttonClasses } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';
import { CLOSURE_NOTE_LIMIT } from '@/lib/merchant-closure-core.mjs';

type Status = { businessStatus: string; note: string | null; reopenOn: string | null; ownerCanChange: boolean };
type Pending = { requestId: string; status: 'OPEN' | 'TEMPORARILY_CLOSED'; note: string | null; reopenOn: string | null };

const btn = cn(buttonClasses({ variant: 'ghost', size: 'md' }), 'w-full whitespace-normal sm:w-auto');
const input = 'mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-3 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export function ClosurePanel({ merchantId, getHeaders, readOnly, onStatus }: { merchantId: string; getHeaders: () => Promise<Record<string, string> | null>; readOnly: boolean; onStatus?: (businessStatus: string) => void }) {
  const t = useT();
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
    if (!headers) { setError(t('owner.common.yourSessionHasEndedSignIn')); return; }
    const response = await fetch(api, { headers, cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.data) { setError(body?.error?.message || t('owner.closure.couldNotLoadYourOpeningStatus')); return; }
    setStatus(body.data as Status);
    onStatus?.((body.data as Status).businessStatus);
  }, [api, getHeaders, onStatus, t]);

  useEffect(() => { void load(); }, [load]);

  const send = async (pending: Pending) => {
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: t('owner.common.yourSessionHasEndedSignIn2') }); return; }
      const response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      const body = await response.json().catch(() => null);
      if (response.status >= 500 || !body) { unknown.current = pending; setMessage({ kind: 'error', text: t('owner.closure.notConfirmedRetrySendsTheSame') }); return; }
      unknown.current = null;
      if (!response.ok) { setMessage({ kind: 'error', text: body.error?.message || t('owner.closure.notSaved') }); return; }
      setClosing(null);
      setMessage({ kind: 'ok', text: pending.status === 'OPEN' ? t('owner.closure.yourPageShowsYouAreOpen') : t('owner.closure.yourPageNowShowsYouAre') });
      await load();
    } catch {
      unknown.current = pending;
      setMessage({ kind: 'error', text: t('owner.closure.couldNotReachBitesiteRetrySends') });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-700" role="alert">{error} <button type="button" className={buttonClasses({ variant: 'ghost', size: 'md' })} onClick={() => void load()}>{t('owner.common.tryAgain')}</button></p>;
  if (!status) return <Loader2 className="h-5 w-5 animate-spin text-ink" />;

  const closed = status.businessStatus === 'TEMPORARILY_CLOSED';
  const locked = readOnly || busy || !status.ownerCanChange;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3 text-ink">
      <p className="text-sm">

        {t('owner.closure.now')} <span className={`font-semibold ${closed ? 'text-amber-800' : 'text-brand'}`}>{closed ? t('owner.closure.temporarilyClosed') : status.businessStatus === 'OPEN' ? t('owner.common.open') : status.businessStatus.replaceAll('_', ' ').toLowerCase()}</span>
        {closed && status.reopenOn ? t('owner.closure.backOn', { date: status.reopenOn }) : ''}
      </p>
      {closed && status.note && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{status.note}</p>}
      {!status.ownerCanChange && <p className="text-sm text-muted">{t('owner.closure.thisStatusIsSetByThe')}</p>}

      {closing ? (
        <form className="space-y-3 rounded-xl border border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(unknown.current ?? { requestId: crypto.randomUUID(), status: 'TEMPORARILY_CLOSED', note: closing.note.trim() || null, reopenOn: closing.reopenOn || null }); }}>
          <label className="block text-sm font-medium">{t('owner.closure.noteForVisitorsOptional')}
            <input className={input} maxLength={CLOSURE_NOTE_LIMIT} placeholder={t('owner.closure.eGClosedForHariRaya')} value={closing.note}
              onChange={(e) => { unknown.current = null; setClosing({ ...closing, note: e.target.value }); }} />
          </label>
          <label className="block text-sm font-medium">{t('owner.closure.expectedToReopenOptional')}
            <input className={input} type="date" min={today} value={closing.reopenOn}
              onChange={(e) => { unknown.current = null; setClosing({ ...closing, reopenOn: e.target.value }); }} />
          </label>
          <p className="text-xs text-muted">{t('owner.closure.forExampleChooseTheDayYou')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={locked} className={cn(btn, "bg-amber-700 text-white")}>{busy ? t('owner.common.saving') : unknown.current ? t('owner.common.retry') : t('owner.closure.markTemporarilyClosed')}</button>
            <button type="button" disabled={busy} onClick={() => { setClosing(null); unknown.current = null; }} className={cn(btn, "border border-line-strong")}>{t('owner.common.cancel')}</button>
          </div>
        </form>
      ) : closed ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={locked} onClick={() => void send(unknown.current ?? { requestId: crypto.randomUUID(), status: 'OPEN', note: null, reopenOn: null })} className={cn(btn, "bg-brand text-white")}>{busy ? t('owner.common.saving') : unknown.current ? t('owner.common.retry') : t('owner.closure.weReOpenAgain')}</button>
          <button type="button" disabled={locked} onClick={() => setClosing({ note: status.note ?? '', reopenOn: status.reopenOn ?? '' })} className={cn(btn, "border border-line-strong")}>{t('owner.closure.changeNoteOrDate')}</button>
        </div>
      ) : (
        <button type="button" disabled={locked} onClick={() => setClosing({ note: '', reopenOn: '' })} className={cn(btn, "border border-amber-700 text-amber-800")}>{t('owner.closure.temporarilyClose')}</button>
      )}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-brand' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
