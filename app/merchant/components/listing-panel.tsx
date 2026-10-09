'use client';
import { useT, useLang, translate, type MessageKey } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useEffect, useRef, useState } from 'react';
import { CHECK_LABELS, intakeNotice, type ListingAction, type ListingCheck, type ListingState } from '@/lib/merchant-review-core.mjs';
import { supabase } from '@/lib/supabase';
import type { SectionHandle } from '@/app/components/section-save/use-section-save';

const btn = cn(buttonClasses({ variant: 'secondary', size: 'md' }), 'min-w-11 whitespace-normal w-full sm:w-auto');
type Pending = { requestId: string; action: ListingAction };
type Props = {
  merchantId: string; state: ListingState; getHeaders: () => Promise<{ Authorization: string } | null>;
  refresh: () => Promise<void>; onState: (state: ListingState) => void;
  beforeAction: () => boolean; onBusy: (busy: boolean) => void;
  register: (id: string, handle: SectionHandle | null) => void;
};
export function ListingPanel({ merchantId, state, getHeaders, refresh, onState, beforeAction, onBusy, register }: Props) {
  const t = useT();
  const lang = useLang();
  const locale = lang === 'zh' ? 'zh-Hans-MY' : lang === 'ms' ? 'ms-MY' : 'en-MY';
  const checkKeys: Record<ListingCheck, MessageKey> = { name: 'owner.common.restaurantName', address: 'owner.common.address', contact: 'owner.listing.phoneWhatsappOrEmail', category: 'owner.listing.cuisineAtLeastOne', dish: 'owner.listing.atLeastOneDishInThe' };
  const intakeKeys: Record<string, MessageKey> = {
    "BiteSite is not taking new restaurants right now. You can still prepare your page; submit it for review when we reopen.": 'owner.listing.bitesiteIsNotTakingNewRestaurants',
    "The pilot is full right now. You can still prepare your page; submit it for review when more places open.": 'owner.listing.thePilotIsFullRightNow',
    "Many restaurants are waiting for review. You can still prepare your page; please submit again in a few days.": 'owner.listing.manyRestaurantsAreWaitingForReview',
  };
  const titles: Record<ListingAction, string> = { submit: t('owner.common.submitForReview'), withdraw: t('owner.listing.withdraw'), publish: t('owner.listing.publish'), hide: t('owner.listing.hide'), discard: t('owner.listing.discardDraft') };
  const confirmText: Partial<Record<ListingAction, { title: string; body: string }>> = {
    publish: { title: t('owner.listing.publishYourRestaurant'), body: t('owner.listing.yourDetailsAndMenuWillBe') },
    hide: { title: t('owner.listing.hideYourRestaurant'), body: t('owner.listing.visitorsWillNoLongerSeeYour') },
    discard: { title: t('owner.listing.discardThisDraft'), body: t('owner.listing.itIsArchivedAndBecomesRead') },
  };
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<ListingAction | null>(null);
  // Before Submit: say so plainly when BiteSite is not taking new restaurants (#34).
  const canSubmit = state.allowedActions.includes('submit');
  const [intake, setIntake] = useState<string | null>(null);
  useEffect(() => {
    if (!canSubmit) return;
    let live = true;
    supabase.rpc('pilot_intake_status').then(({ data }) => { if (live) setIntake(intakeNotice((data as { reason?: string } | null)?.reason)); }, () => {});
    return () => { live = false; };
  }, [canSubmit]);
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
      if (!headers) { setMessage(t('owner.listing.yourSessionHasEndedOrChanged')); return; }
      const response = await fetch(`/api/merchant/restaurants/${encodeURIComponent(merchantId)}/listing`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      const body = await response.json().catch(() => null);
      // Discard answers without a listing state: the restaurant is archived now, so reload the status.
      if (pending.action === 'discard' && response.ok && body?.data) { setUnknown(null); setMessage(t('owner.listing.draftDiscardedItIsArchivedAnd')); await refresh(); return; }
      if (response.status >= 500 || !body || (response.ok && !body.data?.state)) { setUnknown(pending); setMessage(t('owner.listing.theResultIsNotConfirmedRetry')); return; }
      setUnknown(null);
      if (!response.ok) { setMessage((typeof body.error === 'string' ? body.error : body.error?.message) || t('owner.listing.couldNotCompleteThisAction')); await refresh(); return; }
      onState(body.data.state);
      setMessage(pending.action === 'publish' ? t('owner.listing.yourRestaurantIsNowLiveYour') : pending.action === 'submit' ? t('owner.listing.sentForReviewYouCanWithdraw') : pending.action === 'withdraw' ? t('owner.listing.withdrawnYouCanEditAndSubmit') : t('owner.listing.yourRestaurantIsHidden'));
      // A replay may return a past state, so reconcile with the current server state.
      await refresh();
    } catch { setUnknown(pending); setMessage(t('owner.listing.couldNotConfirmTheResultRetry')); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const act = (action: ListingAction) => {
    if (!beforeAction()) { setMessage(t('owner.listing.saveAllUnfinishedChangesAndFinish')); return; }
    if (action === 'publish' || action === 'hide' || action === 'discard') setConfirm(action);
    else void send({ requestId: crypto.randomUUID(), action });
  };
  if (state.stateSource === 'legacy') return <p className="text-sm text-muted">{t('owner.listing.yourListingIsManagedByThe')}</p>;
  const label = state.restriction !== 'none' ? t('owner.listing.listing', { restriction: state.restriction === 'suspended' ? t('owner.common.suspended') : state.restriction === 'archived' ? t('owner.common.archived') : state.restriction }) : state.public ? t('owner.common.live') : state.reviewStatus === 'approved' ? t('owner.listing.approvedNotPublicYet') : state.reviewStatus === 'pending' ? t('owner.listing.waitingForReview') : state.reviewStatus === 'rejected' ? t('owner.common.changesRequested') : t('owner.common.draft');
  return <section aria-labelledby="listing-title" className="rounded-[20px] border border-line-strong bg-white p-5 text-ink sm:p-7">
    <h2 id="listing-title" className="font-extrabold tracking-[-0.02em] text-2xl">{label}</h2>
    {state.pendingSubmission && <p className="mt-2 text-sm">{t('owner.listing.submittedWaitingForReviewWithdrawTo', { date: new Date(state.pendingSubmission.createdAt).toLocaleString(locale) })}</p>}
    {state.reviewStatus === 'rejected' && state.lastDecision?.note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm">{state.lastDecision.note}</p>}
    {state.reviewStatus === 'approved' && !state.public && <p className="mt-2 text-sm">{t('owner.listing.bitesiteHasApprovedYourRestaurantChoose')}</p>}
    {state.public && <a href={`/store/${state.slug}`} target="_blank" rel="noopener noreferrer" className="mt-2 block min-h-11 break-all py-2 underline">/store/{state.slug}</a>}
    {state.reviewStatus !== 'approved' && <ul className="my-4 space-y-1">{(Object.keys(CHECK_LABELS) as ListingCheck[]).map((key) => <li key={key}><a className="block min-h-11 py-2 text-sm underline-offset-4 hover:underline" href={`#${key === 'contact' ? 'contact' : key === 'dish' ? 'menu' : 'basics'}`}><span aria-label={state.checks[key] ? t('owner.listing.complete') : t('owner.listing.missing')}>{state.checks[key] ? '✓' : '○'}</span> {t(checkKeys[key])}</a></li>)}</ul>}
    {canSubmit && intake && <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{intake ? translate(lang, intakeKeys[intake] ?? 'owner.listing.intakeUnavailable') : null}</p>}
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {state.allowedActions.map((action) => <button type="button" key={action} disabled={busy || !!unknown} className={cn(`${btn} ${action === 'submit' || action === 'publish' ? 'bg-brand text-white' : ''}`)} onClick={() => act(action)}>{titles[action]}</button>)}
      {unknown && <button type="button" className={btn} disabled={busy} onClick={() => void send(unknown)}>{t('owner.listing.retryAction', { action: titles[unknown.action] })}</button>}
      <button type="button" className={btn} disabled={busy || !!unknown} onClick={() => void refresh()}>{t('owner.listing.refreshStatus')}</button>
      {state.basicsEditable && !state.firstPublishedAt && <button type="button" className={cn(`${btn} border-red-700 text-red-700`)} disabled={busy || !!unknown} onClick={() => act('discard')}>{titles.discard}</button>}
    </div>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    <dialog ref={dialog} onCancel={() => setConfirm(null)} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl bg-white p-6 text-ink backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-2xl" aria-labelledby="listing-confirm-title">
      <h3 id="listing-confirm-title" className="text-xl font-semibold">{confirm ? confirmText[confirm]?.title : ''}</h3>
      <p className="mt-2 text-sm">{confirm ? confirmText[confirm]?.body : ''}</p>
      <div className="mt-5 flex flex-col gap-2"><button type="button" className={cn(`${btn} ${confirm === 'discard' ? 'bg-red-700 border-red-700' : 'bg-brand'} text-white`)} onClick={() => { if (confirm && beforeAction()) void send({ requestId: crypto.randomUUID(), action: confirm }); }}>{confirm ? titles[confirm] : t('owner.listing.confirm')}</button><button type="button" className={btn} onClick={() => setConfirm(null)}>{t('owner.common.cancel')}</button></div>
    </dialog>
  </section>;
}
