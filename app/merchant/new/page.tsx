"use client";
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { merchantPageUrl } from '@/lib/merchant-context-url.mjs';
import { supabase } from '@/lib/supabase';
import { MERCHANT_TERMS_VERSION } from '@/lib/merchant-terms.mjs';
import { CURRENCIES, type CurrencyCode } from '@/lib/price-format.mjs';
export default function NewRestaurantPage() {
  const t = useT();
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [rightsDeclared, setRightsDeclared] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>('MYR');
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
      const response = await fetch('/api/merchant/restaurants', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ name: name.trim(), requestId: requestId.current, termsVersion: MERCHANT_TERMS_VERSION, rightsDeclared, currency }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || result.error || t('owner.onboarding.couldNotCreateYourRestaurant'));
      window.location.href = merchantPageUrl('/merchant', result.merchant.id);
    } catch (error) { setError(error instanceof Error ? error.message : t('owner.common.pleaseTryAgain')); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-page px-4 py-12"><div className="mx-auto max-w-md rounded-[20px] border bg-white p-6 sm:p-8">
    <h1 className="font-extrabold tracking-[-0.02em] text-3xl text-ink">{t('owner.onboarding.createYourRestaurant')}</h1>
    <p className="mt-3 text-sm text-muted">{t('owner.onboarding.startWithAPrivateDraftYou')}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label htmlFor="restaurant-name" className="block">{t('owner.common.restaurantName')}<input id="restaurant-name" autoComplete="organization" placeholder={t('owner.common.eGKedaiKopiSeriPagi')} required maxLength={120} value={name} disabled={busy} onChange={event => { setName(event.target.value); requestId.current = null; }} className="mt-1 block w-full rounded-lg border px-3 py-2.5 min-h-11 text-base" /></label>
      <fieldset><legend className="text-ink">{t('owner.onboarding.whereIsIt')}</legend><div className="mt-2 grid grid-cols-2 gap-2">{CURRENCIES.map(c => <label key={c.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${currency === c.code ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-ink'}`}><input type="radio" name="restaurant-country" value={c.code} checked={currency === c.code} disabled={busy} onChange={() => { setCurrency(c.code); requestId.current = null; }} className="h-4 w-4" />{c.code === 'MYR' ? t('owner.currency.malaysia') : t('owner.currency.singapore')} <span className="text-muted">({c.symbol})</span></label>)}</div><p className="mt-1 text-xs text-muted">{t('owner.onboarding.menuPricesShowInThisCurrency')}</p></fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm text-ink"><input type="checkbox" required checked={agreed} disabled={busy} onChange={event => { setAgreed(event.target.checked); requestId.current = null; }} className="h-5 w-5 shrink-0" /><span>{t('owner.onboarding.iAgreeToThe')} <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand underline inline-flex min-h-11 min-w-11 items-center" onClick={event => event.stopPropagation()}>{t('legal.terms')}</a> {t('owner.onboarding.andHaveReadThe')} <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand underline inline-flex min-h-11 min-w-11 items-center" onClick={event => event.stopPropagation()}>{t('owner.common.privacyPolicy')}</a>.</span></label>
      <label className="flex min-h-11 items-center gap-3 text-sm text-ink"><input type="checkbox" required checked={rightsDeclared} disabled={busy} onChange={event => { setRightsDeclared(event.target.checked); requestId.current = null; }} className="h-5 w-5 shrink-0" /><span>{t('owner.onboarding.iAmAuthorisedToRepresentThis')}</span></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy || !name.trim() || !agreed || !rightsDeclared} className={cn(buttonClasses({ variant: 'primary', size: 'md' }), 'min-w-11 whitespace-normal', "min-h-11 w-full p-3 disabled:opacity-50")}>{busy ? t('owner.onboarding.creating') : t('owner.onboarding.createPrivateDraft')}</button>
    </form><Link href="/merchant" className="mt-5 inline-flex min-h-11 w-full items-center justify-center text-brand underline">{t('owner.entry.back')}</Link>
  </div></main>;
}
