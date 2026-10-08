/* bitesite/app/merchant/components/link-requests.tsx */
'use client';

import { useT, type MessageKey } from '@/lib/i18n';

/**
 * Owner links (website, Instagram, Facebook, menu PDF, GrabFood, ShopeeFood, foodpanda). A change is a request that the
 * BiteSite team reviews before it appears on the page; one request per link can wait at a time
 * (a new one replaces it), and a waiting request can be withdrawn. Mobile first: one card per
 * link, full-width buttons, URL keyboard. Checks mirror the server (lib/merchant-links-core.mjs).
 */

import type { SectionHandle } from '@/app/components/section-save/use-section-save';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { availableLinkFields, linkProblem, type LinkField, type LinkRequestItem } from '@/lib/merchant-links-core.mjs';

const PROBLEM_KEYS = {
  "too_long": "owner.links.theLinkIsTooLong500",
  "https_only": "owner.links.theLinkMustStartWithHttps",
  "credentials": "owner.links.linksWithAUserNameOr",
  "host": "owner.links.useANormalWebAddressNot",
  "host_instagram": "owner.links.useAnInstagramComLink",
  "host_facebook": "owner.links.useAFacebookComLink",
  "host_grabfood": "owner.links.useAGrabfoodLinkGrabCom",
  "host_shopeefood": "owner.links.useAShopeefoodLinkShopeeCom",
  "host_foodpanda": "owner.links.useAFoodpandaLinkFoodpandaMy",
  "grab_main_site": "owner.links.thisIsGrabSMainWebsite",
  "delivery_home": "owner.links.thisIsTheAppSHome",
} as const;
const LINK_LABELS: Partial<Record<LinkField, MessageKey>> = { website: 'owner.links.website', menu_pdf_url: 'owner.links.menuLinkPdf' };

type Links = Partial<Record<LinkField, string | null>>;
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
  const t = useT();
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/links`;
  const [links, setLinks] = useState<Links | null>(null);
  const [requests, setRequests] = useState<LinkRequestItem[]>([]);
  const [loadError, setLoadError] = useState('');
  // One draft per link, so opening a second link never throws away the first one's typing.
  const [drafts, setDrafts] = useState<Partial<Record<LinkField, string>>>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<LinkField, string>>>({});
  const setDraft = (field: LinkField, value: string | null) => setDrafts((prev) => {
    const next = { ...prev };
    if (value === null) delete next[field]; else next[field] = value;
    return next;
  });
  const setFormError = (field: LinkField, text: string) => setFormErrors((prev) => ({ ...prev, [field]: text }));
  const editing = Object.keys(drafts).length > 0;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    register?.('links', { status: () => ({ dirty: editing, pending: busy, unknown: !!unknown, conflicts: false }), save: async () => 'skipped', discard: () => { setDrafts({}); setFormErrors({}); } });
    return () => register?.('links', null);
  }, [register, busy, unknown, editing]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const headers = await getHeaders();
      if (!headers) { setLoadError(t('owner.common.yourSessionHasEndedSignIn')); return; }
      const response = await fetch(api, { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setLoadError(data?.error?.message || data?.error || t('owner.links.couldNotLoadYourLinks')); return; }
      setLinks(data.data.links as Links);
      setRequests(data.data.requests as LinkRequestItem[]);
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
      setMessage({ kind: 'ok', text: data.data?.status === 'noop' ? t('owner.links.thatIsAlreadyYourCurrentLink') : pending.success });
      await load();
      return true;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (loadError) return <p className="text-sm text-red-700" role="alert">{loadError} <button type="button" className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center underline" onClick={() => void load()}>{t('owner.entry.retry')}</button></p>;
  if (!links) return <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />;

  const locked = readOnly || busy || !!unknown;
  const submit = async (field: LinkField, value: string) => {
    const problem = linkProblem(field, value);
    if (problem) { setFormError(field, t(PROBLEM_KEYS[problem])); return; }
    const url = value.trim() || null;
    if (await send({ requestId: crypto.randomUUID(), body: { action: 'request', field, url }, success: url ? t('owner.links.sentBitesiteWillCheckTheLink') : t('owner.links.sentBitesiteWillRemoveTheLink') })) setDraft(field, null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#6B6560]">{t('owner.links.linksAreCheckedByTheBitesite')}</p>
      {availableLinkFields(links).map(({ field, label, placeholder }) => {
        const current = links[field] ?? null;
        const pending = requests.find((r) => r.field === field && r.status === 'pending');
        const rejected = requests.find((r) => r.field === field && r.status === 'rejected' && !pending);
        const href = safeHref(current);
        const draft = drafts[field];
        const formError = formErrors[field];
        return (
          <div key={field} className="rounded-xl border border-[#DDE5DC] p-3">
            <p className="text-sm font-medium text-[#2C3E2D]">{LINK_LABELS[field] ? t(LINK_LABELS[field]) : label}</p>
            <p className="mt-1 break-all text-sm text-[#2C3E2D]">
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 min-w-11 break-all underline underline-offset-2">{current}</a> : <span className="text-[#6B6560]">{t('owner.links.notSet')}</span>}
            </p>
            {pending && (
              <div className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                <p>{t('owner.links.waitingForReview')} {pending.proposedUrl ? <span className="break-all">{pending.proposedUrl}</span> : t('owner.links.removeThisLink')}</p>
                {(field === 'grabfood' || field === 'shopeefood' || field === 'foodpanda') && pending.proposedUrl && <p className="mt-1">{t('owner.links.bitesiteApprovesItBeforeTheButton')}</p>}
                <button type="button" disabled={locked} onClick={() => void send({ requestId: crypto.randomUUID(), body: { action: 'withdraw', linkRequestId: pending.id }, success: t('owner.common.requestWithdrawn') })}
                  className={`${btn} mt-2 w-full border border-amber-800 sm:w-auto`}>{t('owner.common.withdrawRequest')}</button>
              </div>
            )}
            {rejected && <p className="mt-2 text-sm text-red-700">{t('owner.links.notApproved')} {rejected.reviewNote}</p>}
            {draft !== undefined ? (
              <form className="mt-2 space-y-2" onSubmit={(event) => { event.preventDefault(); void submit(field, draft); }}>
                <label className="block text-sm">{t('owner.links.newLink')}
                  <input className={input} type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder={placeholder} value={draft}
                    onChange={(event) => { setDraft(field, event.target.value); setFormError(field, ''); }} autoFocus />
                </label>
                {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="submit" disabled={locked || !draft.trim()} className={`${btn} bg-[#2C3E2D] text-white`}>{t('owner.common.sendForReview')}</button>
                  {current && <button type="button" disabled={locked} onClick={() => void submit(field, '')} className={`${btn} border border-red-700 text-red-700`}>{t('owner.links.askToRemoveThisLink')}</button>}
                  <button type="button" onClick={() => { setDraft(field, null); setFormError(field, ''); }} className={`${btn} border border-[#C9D6C7]`}>{t('owner.common.cancel')}</button>
                </div>
              </form>
            ) : (
              <button type="button" disabled={locked} onClick={() => { setDraft(field, pending?.proposedUrl ?? current ?? ''); setFormError(field, ''); }}
                className={`${btn} mt-2 w-full border border-[#2C3E2D] text-[#2C3E2D] sm:w-auto`}>{pending ? t('owner.common.changeRequest') : t('owner.common.requestAChange')}</button>
            )}
          </div>
        );
      })}
      {unknown && <button type="button" disabled={busy} onClick={() => void send(unknown)} className={`${btn} w-full border border-[#2C3E2D] sm:w-auto`}>{busy ? t('owner.common.retrying') : t('owner.common.retry')}</button>}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
