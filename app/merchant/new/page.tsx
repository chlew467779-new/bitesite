"use client";
import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { merchantPageUrl } from '@/lib/merchant-context-url.mjs';
import { supabase } from '@/lib/supabase';
import { MERCHANT_TERMS_VERSION } from '@/lib/merchant-terms.mjs';
export default function NewRestaurantPage() {
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [rightsDeclared, setRightsDeclared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await supabase.auth.getSession();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- keep the full reload when the authenticated session is missing
      if (!data.session) { window.location.href = '/merchant/login'; return; }
      requestId.current ??= crypto.randomUUID();
      const response = await fetch('/api/merchant/restaurants', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ name: name.trim(), requestId: requestId.current, termsVersion: MERCHANT_TERMS_VERSION, rightsDeclared }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || result.error || 'Could not create your restaurant.');
      window.location.href = merchantPageUrl('/merchant', result.merchant.id);
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-12"><div className="mx-auto max-w-md rounded-2xl border bg-white p-6 sm:p-8">
    <h1 className="font-serif text-3xl text-[#2C3E2D]">Create your restaurant</h1>
    <p className="mt-3 text-sm text-[#6B6560]">Start with a private draft. You can add your profile and menu before submitting it for review.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label htmlFor="restaurant-name" className="block">Restaurant name<input id="restaurant-name" autoComplete="organization" placeholder="e.g. Kedai Kopi Seri Pagi" required maxLength={120} value={name} disabled={busy} onChange={event => { setName(event.target.value); requestId.current = null; }} className="mt-1 block w-full rounded-lg border px-3 py-2.5" /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm text-[#2C3E2D]"><input type="checkbox" required checked={agreed} disabled={busy} onChange={event => { setAgreed(event.target.checked); requestId.current = null; }} className="h-5 w-5 shrink-0" /><span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline" onClick={event => event.stopPropagation()}>BiteSite Merchant Terms (pilot)</a> and have read the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline" onClick={event => event.stopPropagation()}>Privacy Policy</a>.</span></label>
      <label className="flex min-h-11 items-center gap-3 text-sm text-[#2C3E2D]"><input type="checkbox" required checked={rightsDeclared} disabled={busy} onChange={event => { setRightsDeclared(event.target.checked); requestId.current = null; }} className="h-5 w-5 shrink-0" /><span>I am authorised to represent this restaurant and I have the right to use the text and photos I add.</span></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy || !name.trim() || !agreed || !rightsDeclared} className="min-h-11 w-full rounded-lg bg-[#2C3E2D] p-3 text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create private draft'}</button>
    </form><Link href="/merchant" className="mt-5 inline-flex min-h-11 w-full items-center justify-center text-emerald-800 underline">Back to my restaurants</Link>
  </div></main>;
}
