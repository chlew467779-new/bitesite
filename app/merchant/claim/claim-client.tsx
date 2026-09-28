'use client';

/**
 * Claim an existing restaurant: sign in, say how you are connected, and give evidence BiteSite can
 * check. BiteSite reviews every claim; the account becomes the Owner only after approval. Also
 * lists the account's recent claims. Mobile first: full-width controls, 44px targets.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CLAIM_RELATIONSHIPS, CLAIM_STATUS_TEXT, claimFormProblems, isClaimSlug, type ClaimForm, type ClaimTarget, type MyClaim } from '@/lib/merchant-claim-core.mjs';
import { merchantPageUrl } from '@/lib/merchant-context-url.mjs';

type Load = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'error'; message: string } | { kind: 'ready'; target: ClaimTarget | null; claims: MyClaim[] };
type Pending = { requestId: string; body: Record<string, unknown>; slug: string | null };

const btn = 'inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50 sm:w-auto';
const field = 'mt-1.5 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-2.5 text-base text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';
const STATUS_LABEL: Record<MyClaim['status'], string> = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Not approved', withdrawn: 'Withdrawn', superseded: 'Not approved' };
const EMPTY: ClaimForm = { relationship: '', contactName: '', contactPhone: '', evidence: '' };

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : null;
}

export function ClaimClient({ slug: rawSlug }: { slug: string | null }) {
  const slug = rawSlug && isClaimSlug(rawSlug) ? rawSlug : null;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [form, setForm] = useState<ClaimForm>(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [problems, setProblems] = useState<Partial<Record<keyof ClaimForm, string>>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) { setLoad({ kind: 'signed-out' }); return; }
    try {
      const response = await fetch(`/api/merchant/claims${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`, { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (response.status === 401) { setLoad({ kind: 'signed-out' }); return; }
      if (response.status === 404) { setLoad({ kind: 'error', message: 'We could not find this restaurant on BiteSite.' }); return; }
      if (!response.ok || !data?.data) { setLoad({ kind: 'error', message: data?.error?.message || 'Could not load this page.' }); return; }
      setLoad({ kind: 'ready', target: data.data.target as ClaimTarget | null, claims: data.data.claims as MyClaim[] });
    } catch {
      setLoad({ kind: 'error', message: 'Could not reach BiteSite. Check your connection.' });
    }
  }, [slug]);

  useEffect(() => { void refresh(); }, [refresh]);

  const send = async (pending: Pending, success: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await authHeaders();
      if (!headers) { setLoad({ kind: 'signed-out' }); return; }
      let response: Response;
      try {
        response = await fetch(`/api/merchant/claims${pending.slug ? `?slug=${encodeURIComponent(pending.slug)}` : ''}`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: pending.requestId, ...pending.body }),
        });
      } catch {
        setUnknown(pending);
        setMessage({ kind: 'error', text: 'Could not reach BiteSite. Retry sends the same request, so it is never sent twice.' });
        return;
      }
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        setUnknown(pending);
        setMessage({ kind: 'error', text: 'The result is not confirmed. Retry sends the same request, so it is never sent twice.' });
        return;
      }
      setUnknown(null);
      if (!response.ok) { setMessage({ kind: 'error', text: data.error?.message || 'The request was not sent.' }); return; }
      setMessage({ kind: 'ok', text: success });
      setForm(EMPTY);
      setConfirmed(false);
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const submit = () => {
    const found = claimFormProblems(form);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    if (!confirmed) { setMessage({ kind: 'error', text: 'Please confirm that you are allowed to manage this restaurant.' }); return; }
    void send({ requestId: crypto.randomUUID(), slug, body: { action: 'submit', ...form } }, 'Sent. BiteSite will check your claim and email you the decision, usually within a few working days.');
  };

  const signInHref = `/merchant/login?next=${encodeURIComponent(slug ? `/merchant/claim?restaurant=${slug}` : '/merchant/claim')}`;

  return (
    <main className="min-h-screen bg-[#FAFBF7] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-2xl border border-[#DDE5DC] bg-white p-6 sm:p-8">
          <h1 className="font-serif text-3xl text-[#2C3E2D]">Claim your restaurant</h1>
          <p className="mt-2 text-sm text-[#6B6560]">If your restaurant is already on BiteSite, ask to manage its page. BiteSite checks every claim before you get access.</p>

          {load.kind === 'loading' && <Loader2 className="mt-6 h-6 w-6 animate-spin text-[#2C3E2D]" />}
          {load.kind === 'error' && <p role="alert" className="mt-6 text-sm text-red-700">{load.message}</p>}
          {load.kind === 'signed-out' && (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-[#2C3E2D]">Sign in to your merchant account first, or create one with your email. You come back here afterwards.</p>
              <Link href={signInHref} className={`${btn} bg-[#2C3E2D] text-white`}>Sign in or create an account</Link>
            </div>
          )}

          {load.kind === 'ready' && !load.target && (
            <p className="mt-6 text-sm text-[#2C3E2D]">Open your restaurant&apos;s page on BiteSite and choose <strong>Claim this restaurant</strong> at the bottom of the page.</p>
          )}

          {load.kind === 'ready' && load.target && (() => {
            const target = load.target;
            const pendingHere = target.myPending && target.myPending.merchantId === target.merchantId;
            const pendingElsewhere = target.myPending && !pendingHere;
            return (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl bg-[#F2F5F0] p-4">
                  <p className="text-lg font-semibold text-[#2C3E2D]">{target.name}</p>
                  {target.area && <p className="text-sm text-[#6B6560]">{target.area}</p>}
                </div>
                {target.status === 'already_owner' && (
                  <p className="text-sm text-emerald-800">{CLAIM_STATUS_TEXT.already_owner} <Link href={merchantPageUrl('/merchant', target.merchantId)} className="underline">Open your dashboard</Link></p>
                )}
                {target.status === 'managed' && <p className="text-sm text-[#2C3E2D]">{CLAIM_STATUS_TEXT.managed}</p>}
                {target.status === 'available' && pendingHere && (
                  <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-medium">Your claim is waiting for review.</p>
                    <p className="mt-1">BiteSite may call you or the restaurant to confirm. You will get an email with the decision.</p>
                    <button type="button" disabled={busy || !!unknown} onClick={() => void send({ requestId: crypto.randomUUID(), slug: null, body: { action: 'withdraw', claimId: target.myPending!.id } }, 'Claim withdrawn.')} className={`${btn} mt-3 border border-amber-800`}>Withdraw claim</button>
                  </div>
                )}
                {target.status === 'available' && pendingElsewhere && (
                  <p className="text-sm text-[#2C3E2D]">You already have a claim waiting for another restaurant. Wait for that decision or withdraw it below, then come back.</p>
                )}
                {target.status === 'available' && !target.myPending && (
                  <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
                    <fieldset>
                      <legend className="text-sm font-medium text-[#2C3E2D]">How are you connected to {target.name}?</legend>
                      <div className="mt-2 space-y-2">
                        {CLAIM_RELATIONSHIPS.map((option) => (
                          <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg border border-[#DDE5DC] px-3 text-sm">
                            <input type="radio" name="relationship" value={option.value} checked={form.relationship === option.value} onChange={() => setForm({ ...form, relationship: option.value })} className="h-4 w-4" />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {problems.relationship && <p className="mt-1 text-sm text-red-700">{problems.relationship}</p>}
                    </fieldset>
                    <label htmlFor="claim-name" className="block text-sm font-medium text-[#2C3E2D]">Your name
                      <input id="claim-name" autoComplete="name" maxLength={120} value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} className={field} />
                      {problems.contactName && <span className="mt-1 block text-sm font-normal text-red-700">{problems.contactName}</span>}
                    </label>
                    <label htmlFor="claim-phone" className="block text-sm font-medium text-[#2C3E2D]">Your phone number
                      <input id="claim-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} placeholder="+60 12-345 6789" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} className={field} />
                      {problems.contactPhone && <span className="mt-1 block text-sm font-normal text-red-700">{problems.contactPhone}</span>}
                    </label>
                    <label htmlFor="claim-evidence" className="block text-sm font-medium text-[#2C3E2D]">How can BiteSite confirm this?
                      <span className="mt-0.5 block text-xs font-normal text-[#6B6560]">For example: your SSM registration number, a good time to call the restaurant&apos;s phone, or an email from the restaurant&apos;s own domain.</span>
                      <textarea id="claim-evidence" rows={4} maxLength={1000} value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} className={field} />
                      {problems.evidence && <span className="mt-1 block text-sm font-normal text-red-700">{problems.evidence}</span>}
                    </label>
                    <label className="flex min-h-11 items-start gap-3 text-sm text-[#2C3E2D]">
                      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
                      I confirm that I am allowed to manage this restaurant and that this information is true.
                    </label>
                    <button type="submit" disabled={busy || !!unknown} className={`${btn} bg-[#2C3E2D] text-white`}>{busy ? 'Sending…' : 'Send claim for review'}</button>
                  </form>
                )}
              </div>
            );
          })()}

          {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-4 text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}>{message.text}</p>}
          {unknown && <button type="button" disabled={busy} onClick={() => void send(unknown, 'Done.')} className={`${btn} mt-3 border border-[#2C3E2D]`}>Retry</button>}
        </div>

        {load.kind === 'ready' && load.claims.length > 0 && (
          <div className="rounded-2xl border border-[#DDE5DC] bg-white p-6">
            <h2 className="text-base font-semibold text-[#2C3E2D]">Your claims</h2>
            <ul className="mt-3 space-y-3">
              {load.claims.map((claim) => (
                <li key={claim.id} className="rounded-lg border border-[#EEF2EC] p-3 text-sm">
                  <p className="font-medium text-[#2C3E2D]">{claim.merchantName} <span className="font-normal text-[#6B6560]">· {STATUS_LABEL[claim.status]}</span></p>
                  <p className="text-xs text-[#6B6560]">Sent {new Date(claim.createdAt).toLocaleDateString()}</p>
                  {claim.reviewNote && claim.status !== 'approved' && <p className="mt-1 text-[#2C3E2D]">{claim.reviewNote}</p>}
                  {claim.status === 'approved' && <Link href={merchantPageUrl('/merchant', claim.merchantId)} className="mt-1 inline-flex min-h-11 items-center text-emerald-800 underline">Open the dashboard</Link>}
                  {claim.status === 'pending' && (
                    <button type="button" disabled={busy || !!unknown} onClick={() => void send({ requestId: crypto.randomUUID(), slug: null, body: { action: 'withdraw', claimId: claim.id } }, 'Claim withdrawn.')} className={`${btn} mt-2 border border-[#C9D6C7]`}>Withdraw</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href="/merchant" className="inline-flex min-h-11 items-center text-sm text-emerald-800 underline">Back to my restaurants</Link>
      </div>
    </main>
  );
}
