/* bitesite/app/merchant/components/currency-setting.tsx */
'use client';

/**
 * "Prices shown in" (#24, Singapore): RM for Malaysia, S$ for Singapore. Saved at once, no review;
 * it only changes the symbol in front of every menu price on the restaurant page.
 */

import { useCallback, useEffect, useState } from 'react';
import { CURRENCIES, type CurrencyCode } from '@/lib/price-format.mjs';

export function CurrencySetting({ merchantId, getHeaders, readOnly, onCurrency }: {
  merchantId: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  readOnly: boolean;
  onCurrency: (currency: CurrencyCode) => void;
}) {
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/currency`;
  const [currency, setCurrency] = useState<CurrencyCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

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
      if (!headers) { setMessage({ kind: 'error', text: 'Your session has ended. Sign in again.' }); return; }
      const response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: next }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setMessage({ kind: 'error', text: body?.error?.message || 'Not saved. Try again.' }); return; }
      setCurrency(next);
      onCurrency(next);
      setMessage({ kind: 'ok', text: 'Saved. Your page shows the new currency now.' });
    } catch {
      setMessage({ kind: 'error', text: 'Could not reach BiteSite. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (!currency) return null;
  return (
    <fieldset className="rounded-xl border border-[#DDE5DC] p-3">
      <legend className="px-1 text-sm font-medium text-[#2C3E2D]">Prices shown in</legend>
      <div className="grid grid-cols-2 gap-2">
        {CURRENCIES.map((c) => (
          <label key={c.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${currency === c.code ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-[#C9D6C7] text-[#2C3E2D]'}`}>
            <input type="radio" name={`currency-${merchantId}`} value={c.code} checked={currency === c.code} disabled={busy || readOnly} onChange={() => void choose(c.code)} className="h-4 w-4" />
            {c.symbol} <span className="text-[#6B6560]">({c.country})</span>
          </label>
        ))}
      </div>
      {message && <p className={`mt-2 text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
    </fieldset>
  );
}
