'use client';

import { useEffect, useRef, useState } from 'react';
import { CHECK_LABELS, type ListingAction, type ListingCheck, type ListingState } from '@/lib/merchant-review-core.mjs';
import type { SectionHandle } from '@/app/components/section-save/use-section-save';

const titles: Record<ListingAction, string> = { submit: 'Submit for review', withdraw: 'Withdraw', publish: 'Publish', hide: 'Hide', discard: 'Discard draft' };
const confirmText: Partial<Record<ListingAction, { title: string; body: string }>> = {
  publish: { title: 'Publish your restaurant?', body: 'Your details and menu will be visible to everyone. Future edits to your description, contact details and menu appear immediately.' },
  hide: { title: 'Hide your restaurant?', body: 'Visitors will no longer see your restaurant page. You can publish it again later.' },
  discard: { title: 'Discard this draft?', body: 'It is archived and becomes read-only; it no longer counts toward your three drafts. Ask the BiteSite team through Feedback if you need it back.' },
};
const btn = 'min-h-11 w-full rounded-lg border border-[#2C3E2D] px-4 py-2 text-sm font-medium disabled:opacity-50 sm:w-auto';
type Pending = { requestId: string; action: ListingAction };
type Props = {
  merchantId: string; state: ListingState; getHeaders: () => Promise<{ Authorization: string } | null>;
  refresh: () => Promise<void>; onState: (state: ListingState) => void;
  beforeAction: () => boolean; onBusy: (busy: boolean) => void;
  register: (id: string, handle: SectionHandle | null) => void;
};
export function ListingPanel({ merchantId, state, getHeaders, refresh, onState, beforeAction, onBusy, register }: Props) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<ListingAction | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close(); }, [confirm]);
  useEffect(() => { onBusy(busy || !!unknown); return () => onBusy(false); }, [busy, unknown, onBusy]);
  useEffect(() => {
    register('listing', { status: () => ({ dirty: false, conflicts: false, pending: busy, unknown: !!unknown }), save: async () => 'noop', discard: () => {} });
    return () => register('listing', null);
  }, [register, busy, unknown]);

  const send = async (pending: Pending) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage(''); setConfirm(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage('Your session has ended or changed. Sign in again as the same account, then retry.'); return; }
      const response = await fetch(`/api/merchant/restaurants/${encodeURIComponent(merchantId)}/listing`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      const body = await response.json().catch(() => null);
      // Discard answers without a listing state: the restaurant is archived now, so reload the status.
      if (pending.action === 'discard' && response.ok && body?.data) { setUnknown(null); setMessage('Draft discarded. It is archived and read-only now.'); await refresh(); return; }
      if (response.status >= 500 || !body || (response.ok && !body.data?.state)) { setUnknown(pending); setMessage('The result is not confirmed. Retry safely sends the same request.'); return; }
      setUnknown(null);
      if (!response.ok) { setMessage((typeof body.error === 'string' ? body.error : body.error?.message) || 'Could not complete this action.'); await refresh(); return; }
      onState(body.data.state);
      setMessage(pending.action === 'publish' ? 'Your restaurant is now live. Your public address is below.' : pending.action === 'submit' ? 'Sent for review. You can withdraw if you need to edit.' : pending.action === 'withdraw' ? 'Withdrawn. You can edit and submit again.' : 'Your restaurant is hidden.');
      // A replay may return a past state, so reconcile with the current server state.
      await refresh();
    } catch { setUnknown(pending); setMessage('Could not confirm the result. Retry safely sends the same request.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const act = (action: ListingAction) => {
    if (!beforeAction()) { setMessage('Save all unfinished changes and finish any pending requests before continuing.'); return; }
    if (action === 'publish' || action === 'hide' || action === 'discard') setConfirm(action);
    else void send({ requestId: crypto.randomUUID(), action });
  };
  if (state.stateSource === 'legacy') return <p className="text-sm text-[#6B6560]">Your listing is managed by the BiteSite team.</p>;
  const label = state.restriction !== 'none' ? `Listing ${state.restriction}` : state.public ? 'Live' : state.reviewStatus === 'approved' ? 'Approved – not public yet' : state.reviewStatus === 'pending' ? 'Waiting for review' : state.reviewStatus === 'rejected' ? 'Changes requested' : 'Draft';
  return <section aria-labelledby="listing-title" className="rounded-2xl border border-[#C9D6C7] bg-white p-5 text-[#2C3E2D] sm:p-7">
    <h2 id="listing-title" className="font-serif text-2xl">{label}</h2>
    {state.pendingSubmission && <p className="mt-2 text-sm">Submitted {new Date(state.pendingSubmission.createdAt).toLocaleString()}. Waiting for review — withdraw to edit.</p>}
    {state.reviewStatus === 'rejected' && state.lastDecision?.note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm">{state.lastDecision.note}</p>}
    {state.reviewStatus === 'approved' && !state.public && <p className="mt-2 text-sm">BiteSite has approved your restaurant. Choose Publish when you are ready.</p>}
    {state.public && <a href={`/store/${state.slug}`} target="_blank" rel="noopener noreferrer" className="mt-2 block min-h-11 break-all py-2 underline">/store/{state.slug}</a>}
    {state.reviewStatus !== 'approved' && <ul className="my-4 space-y-1">{(Object.keys(CHECK_LABELS) as ListingCheck[]).map((key) => <li key={key}><a className="block min-h-11 py-2 text-sm underline-offset-4 hover:underline" href={`#${key === 'contact' ? 'contact' : key === 'dish' ? 'menu' : 'basics'}`}><span aria-label={state.checks[key] ? 'Complete' : 'Missing'}>{state.checks[key] ? '✓' : '○'}</span> {CHECK_LABELS[key]}</a></li>)}</ul>}
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {state.allowedActions.map((action) => <button type="button" key={action} disabled={busy || !!unknown} className={`${btn} ${action === 'submit' || action === 'publish' ? 'bg-[#2C3E2D] text-white' : ''}`} onClick={() => act(action)}>{titles[action]}</button>)}
      {unknown && <button type="button" className={btn} disabled={busy} onClick={() => void send(unknown)}>Retry {titles[unknown.action].toLowerCase()}</button>}
      <button type="button" className={btn} disabled={busy || !!unknown} onClick={() => void refresh()}>Refresh status</button>
      {state.basicsEditable && !state.firstPublishedAt && <button type="button" className={`${btn} border-red-700 text-red-700`} disabled={busy || !!unknown} onClick={() => act('discard')}>{titles.discard}</button>}
    </div>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    <dialog ref={dialog} onCancel={() => setConfirm(null)} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl bg-white p-6 text-[#2C3E2D] backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-2xl" aria-labelledby="listing-confirm-title">
      <h3 id="listing-confirm-title" className="text-xl font-semibold">{confirm ? confirmText[confirm]?.title : ''}</h3>
      <p className="mt-2 text-sm">{confirm ? confirmText[confirm]?.body : ''}</p>
      <div className="mt-5 flex flex-col gap-2"><button type="button" className={`${btn} ${confirm === 'discard' ? 'bg-red-700 border-red-700' : 'bg-[#2C3E2D]'} text-white`} onClick={() => { if (confirm && beforeAction()) void send({ requestId: crypto.randomUUID(), action: confirm }); }}>{confirm ? titles[confirm] : 'Confirm'}</button><button type="button" className={btn} onClick={() => setConfirm(null)}>Cancel</button></div>
    </dialog>
  </section>;
}
