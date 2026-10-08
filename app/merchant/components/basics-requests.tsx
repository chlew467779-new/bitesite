/* bitesite/app/merchant/components/basics-requests.tsx */
'use client';

import { useT, useLang, presetLabel, type Lang, type MessageKey } from '@/lib/i18n';

/**
 * Owner listing basics after approval (name, address, area, cuisine). A change is a request that
 * the BiteSite team reviews before it appears on the page; one request can wait at a time (a new
 * one replaces it) and it can be withdrawn. The map pin is not changed by an address request.
 * Mobile first: full-width buttons, 44px targets.
 */

import type { SectionHandle } from '@/app/components/section-save/use-section-save';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CUISINE_TAGS } from '@/lib/presets';
import { basicsChanges, type BasicsRead, type BasicsRequestItem, type BasicsValues } from '@/lib/merchant-basics-core.mjs';
import { TextField } from './text-field';
import { AreaField } from './area-field';

const FORM_MESSAGES: Record<string, MessageKey> = {
  "Enter the restaurant name.": "owner.listing.nameRequired",
  "The name can be at most 160 characters.": "owner.listing.nameTooLong",
  "Enter the address.": "owner.listing.addressRequired",
  "The address can be at most 500 characters.": "owner.listing.addressTooLong",
  "The area can be at most 160 characters.": "owner.listing.areaTooLong",
  "Choose 1 to 3 cuisines.": "owner.listing.cuisineRange",
};

type Draft = { name: string; address: string; area: string; cuisine: string[] };
type Pending = { requestId: string; body: Record<string, unknown>; success: string };

const btn = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50';

function describe(changes: Partial<BasicsValues>, t: ReturnType<typeof useT>, lang: Lang) {
  const parts: string[] = [];
  if (changes.name != null) parts.push(t('owner.listing.name', { name: changes.name }));
  if (changes.address != null) parts.push(t('owner.listing.address', { address: changes.address, area: changes.area ? ` (${changes.area})` : '' }));
  if (changes.cuisine) parts.push(t('owner.listing.cuisine', { cuisine: changes.cuisine.map((tag) => presetLabel(lang, tag)).join(', ') }));
  return parts;
}

function draftFrom(current: BasicsValues, pending?: BasicsRequestItem): Draft {
  const c = pending?.changes ?? {};
  return {
    name: c.name ?? current.name ?? '',
    address: c.address ?? current.address ?? '',
    area: (c.address != null ? c.area : current.area) ?? '',
    cuisine: c.cuisine ?? current.cuisine ?? [],
  };
}

export function BasicsRequests({ merchantId, getHeaders, readOnly, register, areaRequests }: {
  merchantId: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  areaRequests?: import('@/lib/area-requests.mjs').AreaRequests;
  readOnly: boolean;
  register?: (id: string, handle: SectionHandle | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/basics`;
  const [state, setState] = useState<BasicsRead | null>(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    register?.('basics-requests', { status: () => ({ dirty: !!draft, pending: busy, unknown: !!unknown, conflicts: false }), save: async () => 'skipped', discard: () => { setDraft(null); } });
    return () => register?.('basics-requests', null);
  }, [register, busy, unknown, draft]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const headers = await getHeaders();
      if (!headers) { setLoadError(t('owner.common.yourSessionHasEndedSignIn')); return; }
      const response = await fetch(api, { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setLoadError(data?.error?.message || t('owner.listing.couldNotLoadYourChangeRequests')); return; }
      setState(data.data as BasicsRead);
    } catch {
      setLoadError(t('owner.common.couldNotReachBitesiteCheckYour'));
    }
  }, [api, getHeaders, t]);

  useEffect(() => { void load(); }, [load]);

  const send = async (pending: Pending) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: t('owner.common.yourSessionHasEndedSignIn2') }); return false; }
      let response: Response;
      try {
        response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: pending.requestId, ...pending.body }) });
      } catch {
        setUnknown(pending);
        setMessage({ kind: 'error', text: t('owner.common.couldNotReachBitesiteRetrySends') });
        return false;
      }
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        setUnknown(pending);
        setMessage({ kind: 'error', text: t('owner.common.theResultIsNotConfirmedRetry') });
        return false;
      }
      setUnknown(null);
      if (!response.ok) { setMessage({ kind: 'error', text: data.error?.message || t('owner.common.theRequestWasNotSent') }); return false; }
      setMessage({ kind: 'ok', text: data.data?.status === 'noop' ? t('owner.listing.theseAreAlreadyYourCurrentDetails') : pending.success });
      await load();
      return true;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (loadError) return <p className="text-sm text-red-700" role="alert">{loadError} <button type="button" className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center underline" onClick={() => void load()}>{t('owner.entry.retry')}</button></p>;
  if (!state) return <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />;

  const pending = state.requests.find((r) => r.status === 'pending');
  const latest = state.requests[0];
  const rejected = !pending && latest?.status === 'rejected' ? latest : undefined;
  const approved = !pending && latest?.status === 'approved' ? latest : undefined;
  if (!state.requestable && !pending && !rejected) return null;
  const locked = readOnly || busy || !!unknown;

  const submit = async () => {
    if (!draft) return;
    const result = basicsChanges(state.current, draft);
    if (!result.ok) { setFormError(FORM_MESSAGES[result.message] ? t(FORM_MESSAGES[result.message]) : result.message); return; }
    if (Object.keys(result.changes).length === 0) { setFormError(t('owner.listing.changeAtLeastOneDetailFirst')); return; }
    if (await send({ requestId: crypto.randomUUID(), body: { action: 'request', changes: result.changes }, success: t('owner.listing.sentBitesiteWillCheckTheChange') })) setDraft(null);
  };
  const cuisineOptions = draft ? [...new Set([...CUISINE_TAGS, ...draft.cuisine])] : [];

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-[#EEF2EC] bg-[#FAFBF7] p-4">
      <h3 className="text-sm font-semibold text-[#2C3E2D]">{t('owner.listing.changeTheseDetails')}</h3>
      <p className="text-xs text-[#6B6560]">{t('owner.listing.bitesiteChecksANewNameAddress')}</p>
      {pending && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{t('owner.listing.waitingForReview')}</p>
          <ul className="mt-1 space-y-1 break-words">{describe(pending.changes, t, lang).map((line) => <li key={line}>{line}</li>)}</ul>
          <button type="button" disabled={locked} onClick={() => void send({ requestId: crypto.randomUUID(), body: { action: 'withdraw', basicsRequestId: pending.id }, success: t('owner.common.requestWithdrawn') })}
            className={`${btn} mt-2 w-full border border-amber-800 sm:w-auto`}>{t('owner.common.withdrawRequest')}</button>
        </div>
      )}
      {rejected && <p className="whitespace-pre-line break-words text-sm text-red-700">{t('owner.listing.yourLastRequestWasNotApproved')} {rejected.reviewNote}</p>}
      {approved && !draft && <p className="text-sm text-emerald-800">{t('owner.listing.yourLastChangeWasApprovedAnd')}</p>}
      {draft ? (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <TextField name="request-name" label={t('owner.common.restaurantName')} autoComplete="organization" placeholder={t('owner.common.eGKedaiKopiSeriPagi')} maxLength={160} showCount value={draft.name} onChange={(v) => { setDraft({ ...draft, name: v }); setFormError(''); }} />
          <TextField name="request-address" label={t('owner.common.address')} autoComplete="street-address" placeholder={t('owner.listing.eG12JalanTasikUtama')} multiline maxLength={500} showCount value={draft.address} onChange={(v) => { setDraft({ ...draft, address: v }); setFormError(''); }} />
          <AreaField name="request-area" label={t('owner.listing.areaOptional')} value={draft.area} onChange={(v) => { setDraft({ ...draft, area: v }); setFormError(''); }} merchantId={merchantId} address={draft.address} getHeaders={getHeaders} areaRequests={areaRequests} />
          <fieldset>
            <legend className="text-sm font-medium">{t('owner.listing.cuisineChooseUpTo3')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">{cuisineOptions.map((tag) => {
              const on = draft.cuisine.includes(tag);
              return <button key={tag} type="button" aria-pressed={on} disabled={!on && draft.cuisine.length >= 3}
                onClick={() => { setDraft({ ...draft, cuisine: on ? draft.cuisine.filter((v) => v !== tag) : [...draft.cuisine, tag] }); setFormError(''); }}
                className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-50 ${on ? 'border-[#2C3E2D] bg-[#2C3E2D] text-white' : 'border-[#C9D6C7] bg-white'}`}>{presetLabel(lang, tag)}</button>;
            })}</div>
          </fieldset>
          <p className="text-xs text-[#6B6560]">{t('owner.listing.ifYouMovedBitesiteAlsoUpdates')}</p>
          {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={locked} className={`${btn} bg-[#2C3E2D] text-white`}>{t('owner.common.sendForReview')}</button>
            <button type="button" onClick={() => { setDraft(null); setFormError(''); }} className={`${btn} border border-[#C9D6C7] bg-white`}>{t('owner.common.cancel')}</button>
          </div>
        </form>
      ) : state.requestable && (
        <button type="button" disabled={locked} onClick={() => { setDraft(draftFrom(state.current, pending)); setFormError(''); setMessage(null); }}
          className={`${btn} w-full border border-[#2C3E2D] bg-white text-[#2C3E2D] sm:w-auto`}>{pending ? t('owner.common.changeRequest') : t('owner.common.requestAChange')}</button>
      )}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {unknown && <button type="button" disabled={busy} onClick={() => void send(unknown)} className={`${btn} w-full border border-[#2C3E2D] bg-white sm:w-auto`}>{t('owner.common.retry')}</button>}
    </div>
  );
}
