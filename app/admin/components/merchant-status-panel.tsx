/* bitesite/app/admin/components/merchant-status-panel.tsx */
'use client';

/**
 * Admin governance panel (D2-C): shows whether the restaurant is public, hidden, suspended or
 * archived, and offers only the actions the database allows right now (publish, hide, suspend,
 * lift suspension). Each action is confirmed in a dialog; hide, suspend and lifting a suspension
 * need a reason, which goes into the change log. If the result of a request is unknown (network
 * failure), Retry resends the same request id, so the action is never applied twice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  GOVERNANCE_ACTION_INFO,
  GOVERNANCE_REASON_MAX,
  describeGovernanceState,
  type GovernanceAction,
  type GovernanceState,
} from '@/lib/merchant-governance-core.mjs';

type Pending = { action: GovernanceAction; reason: string; requestId: string };

const panel = 'rounded-xl bg-white p-5 text-[#2C3E2D]';

export default function MerchantStatusPanel({ merchantId, merchantName, token }: { merchantId: string; merchantName: string; token: string | null }) {
  const [state, setState] = useState<GovernanceState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState<GovernanceAction | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const sendingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const response = await fetch(`/api/admin/merchants/${encodeURIComponent(merchantId)}/status`, { headers: { 'x-admin-token': token || '' }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setLoadError(data?.error?.message || 'Could not load the status.'); return; }
      setState(data.data.state as GovernanceState);
    } catch {
      setLoadError('Could not reach the server.');
    }
  }, [merchantId, token]);

  useEffect(() => { void load(); }, [load]);

  const send = async (pending: Pending) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/merchants/${encodeURIComponent(merchantId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
        body: JSON.stringify({ requestId: pending.requestId, action: pending.action, reason: pending.reason.trim() || null }),
      });
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        // The action may or may not have been applied: keep the request id for a safe retry.
        setUnknown(pending);
        setDialog(null);
        setMessage({ kind: 'error', text: 'The result is not confirmed. Retry sends the same request, so it is never applied twice.' });
        return;
      }
      setUnknown(null);
      setDialog(null);
      setReason('');
      if (!response.ok) {
        setMessage({ kind: 'error', text: data?.error?.message || 'The action was not applied.' });
        await load();
        return;
      }
      setState(data.data.state as GovernanceState);
      const label = GOVERNANCE_ACTION_INFO[pending.action].label;
      setMessage({ kind: 'ok', text: data.data.status === 'noop' ? `Nothing to change: “${label}” was already in effect.` : `${label}: done. The change is in the change log.` });
    } catch {
      setUnknown(pending);
      setDialog(null);
      setMessage({ kind: 'error', text: 'Could not reach the server. Retry sends the same request, so it is never applied twice.' });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const open = (action: GovernanceAction) => { setDialog(action); setReason(''); setMessage(null); };
  const close = () => { if (!sendingRef.current) setDialog(null); };

  useEffect(() => {
    if (!dialog) return;
    const node = dialogRef.current;
    node?.querySelector<HTMLElement>('textarea, button')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !sendingRef.current) setDialog(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  const info = dialog ? GOVERNANCE_ACTION_INFO[dialog] : null;
  const reasonMissing = !!info?.reasonRequired && !reason.trim();

  return (
    <div className={panel}>
      <div className="mb-4">
        <h3 className="font-semibold">Visibility and suspension</h3>
        <p className="mt-1 text-xs text-[#6B6560]">Publishing, hiding and suspending are recorded in the change log. Saving sections never changes them. Archiving and business status changes are not available here yet.</p>
      </div>

      {loadError && <p className="text-sm text-red-700" role="alert">{loadError} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!state && !loadError && <Loader2 className="h-5 w-5 animate-spin text-amber-600" />}

      {state && (
        <>
          <p className="text-sm">Status: <span data-testid="governance-state" className="font-semibold">{describeGovernanceState(state)}</span></p>
          {!state.hasValidContact && state.allowedActions.length > 0 && !state.public && (
            <p className="mt-1 text-xs text-[#6B6560]">Publishing needs at least one valid phone, WhatsApp or email in the Contact section.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {state.allowedActions.map((action) => (
              <button key={action} type="button" disabled={sending || !!unknown} onClick={() => open(action)}
                className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${GOVERNANCE_ACTION_INFO[action].danger ? 'border border-red-700 text-red-700' : 'bg-[#2C3E2D] text-white'}`}>
                {GOVERNANCE_ACTION_INFO[action].label}
              </button>
            ))}
            {state.allowedActions.length === 0 && <p className="text-sm text-[#6B6560]">No actions are available for this restaurant here.</p>}
          </div>
        </>
      )}

      {message && <p className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {unknown && (
        <button type="button" disabled={sending} onClick={() => void send(unknown)} className="mt-2 rounded-lg border border-[#2C3E2D] px-4 py-2 text-sm font-medium disabled:opacity-50">
          {sending ? 'Retrying…' : 'Retry'}
        </button>
      )}

      {dialog && info && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="governance-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-[#2C3E2D] shadow-xl">
            <h2 id="governance-title" className="font-semibold">{info.title}</h2>
            <p className="mt-1 text-sm font-medium">{merchantName}</p>
            <p className="mt-2 text-sm">{info.effect}</p>
            <label htmlFor="governance-reason" className="mt-4 block text-sm font-medium">Reason{info.reasonRequired ? '' : ' (optional)'}</label>
            <textarea id="governance-reason" rows={3} maxLength={GOVERNANCE_REASON_MAX} value={reason} disabled={sending} onChange={(event) => setReason(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20" />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={sending} onClick={close} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">Cancel</button>
              <button type="button" disabled={sending || reasonMissing}
                onClick={() => void send({ action: dialog, reason, requestId: crypto.randomUUID() })}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${info.danger ? 'bg-red-700' : 'bg-[#2C3E2D]'}`}>
                {sending ? 'Working…' : info.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
