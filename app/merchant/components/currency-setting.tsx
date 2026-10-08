/* bitesite/app/merchant/components/currency-setting.tsx */
'use client';

/**
 * "Prices shown in" (#24, Singapore): RM for Malaysia, S$ for Singapore. Saved at once, no review;
 * it only changes the symbol in front of every menu price on the restaurant page.
 * When the saved area is in the other country, a reminder shows under the choice (T6).
 */

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { CURRENCIES, currencyAreaMismatch, type CurrencyCode } from '@/lib/price-format.mjs';
import { findArea } from '@/lib/areas-core.mjs';
import { getAreas } from '@/lib/supabase';

export function CurrencySetting({ merchantId, area, getHeaders, readOnly, onCurrency }: {
  merchantId: string;
  /** The saved (live) area, for the country check. */
  area?: string | null;
  getHeaders: () => Promise<Record<string, string> | null>;
  readOnly: boolean;
  onCurrency: (currency: CurrencyCode) => void;
}) {
  const t = useT();
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/currency`;
  const [currency, setCurrency] = useState<CurrencyCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [areaCountry, setAreaCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!area) { setAreaCountry(null); return; }
    getAreas()
      .then((areas) => { if (!cancelled) setAreaCountry(findArea(areas, area)?.country ?? null); })
      .catch(() => { /* no reminder when the list cannot load */ });
    return () => { cancelled = true; };
  }, [area]);
  const mismatch = currency ? currencyAreaMismatch(currency, area, areaCountry) : null;

  const load = useCallback(async () => {
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const response = await fetch(api, { headers, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      const value = body?.data?.currency;
      if (response.ok && (value === 'MYR' || value === 'SGD')) { setCurrency(value); onCurrency(value); }
    } catch {
      // Prices then show RM, as before; the choice appears on the next load.
    }
  }, [api, getHeaders, onCurrency]);
  useEffect(() => { void load(); }, [load]);

  const choose = async (next: CurrencyCode) => {
    if (busy || readOnly || next === currency) return;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: t('owner.common.yourSessionHasEndedSignIn') }); return; }
      const response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: next }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setMessage({ kind: 'error', text: body?.error?.message || t('owner.common.notSavedTryAgain') }); return; }
      setCurrency(next);
      onCurrency(next);
      setMessage({ kind: 'ok', text: t('owner.currency.savedYourPageShowsTheNew') });
    } catch {
      setMessage({ kind: 'error', text: t('owner.currency.couldNotReachBitesiteTryAgain') });
    } finally {
      setBusy(false);
    }
  };

  if (!currency) return null;
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-medium text-ink">{t('owner.currency.pricesShownIn')}</legend>
      <div className="grid grid-cols-2 gap-2">
        {CURRENCIES.map((c) => (
          <label key={c.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${currency === c.code ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-ink'}`}>
            <input type="radio" name={`currency-${merchantId}`} value={c.code} checked={currency === c.code} disabled={busy || readOnly} onChange={() => void choose(c.code)} className="h-4 w-4" />
            {c.symbol} <span className="text-muted">({t(c.code === 'MYR' ? 'owner.currency.malaysia' : 'owner.currency.singapore')})</span>
          </label>
        ))}
      </div>
      {mismatch && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900" role="note">{t('owner.currency.mismatch', { symbol: currency === 'SGD' ? 'S$' : 'RM', country: t(currency === 'SGD' ? 'owner.currency.singapore' : 'owner.currency.malaysia'), area: area ?? '', areaCountry: t(areaCountry === 'SG' ? 'owner.currency.singapore' : 'owner.currency.malaysia') })} {t('owner.currency.checkThatBothAreRight')}</p>}
      {message && <p className={`mt-2 text-sm ${message.kind === 'ok' ? 'text-brand' : 'text-red-700'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
    </fieldset>
  );
}
