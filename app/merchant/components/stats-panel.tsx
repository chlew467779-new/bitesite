'use client';

/**
 * Owner statistics (mobile first): how many people opened the restaurant page and what they did,
 * for the last 7 / 30 / 90 days, with a simple daily bar chart (plus a text summary for screen
 * readers). Counts include the restaurant's former web addresses. Previews are never counted.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Stats = {
  days: number;
  from: string;
  to: string;
  totals: Record<string, number>;
  uniqueVisitors: number;
  daily: { date: string; views: number }[];
};

const RANGES = [7, 30, 90] as const;
const ACTIONS: { key: string; label: string }[] = [
  { key: 'menu_view', label: 'Menu views' },
  { key: 'whatsapp_click', label: 'WhatsApp taps' },
  { key: 'phone_click', label: 'Calls' },
  { key: 'directions_click', label: 'Directions' },
  { key: 'merchant_order_click', label: 'Order taps' },
  { key: 'website_click', label: 'Website taps' },
  { key: 'email_click', label: 'Email taps' },
  { key: 'booking_submit', label: 'Bookings' },
];

export function StatsPanel({ merchantId, getHeaders }: { merchantId: string; getHeaders: () => Promise<Record<string, string> | null> }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getHeaders();
      if (!headers) { setError('Your session has ended. Sign in again.'); return; }
      const response = await fetch(`/api/merchant/restaurants/${encodeURIComponent(merchantId)}/stats?days=${days}`, { headers, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) { setError(body?.error?.message || 'Could not load your statistics.'); return; }
      setStats(body.data as Stats);
    } catch {
      setError('Could not reach BiteSite. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [merchantId, days, getHeaders]);

  useEffect(() => { void load(); }, [load]);

  const max = Math.max(1, ...(stats?.daily ?? []).map((d) => d.views));
  const actions = stats ? ACTIONS.filter((a) => a.key === 'menu_view' || a.key === 'whatsapp_click' || a.key === 'phone_click' || a.key === 'directions_click' || (stats.totals[a.key] ?? 0) > 0) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}
            className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium sm:flex-none ${days === r ? 'border-[#2C3E2D] bg-[#2C3E2D] text-white' : 'border-[#C9D6C7] text-[#2C3E2D]'}`}>
            {r} days
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error} <button type="button" className="ml-1 min-h-11 underline" onClick={() => void load()}>Try again</button></p>}
      {!stats && !error && <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />}
      {stats && (
        <div className={loading ? 'opacity-60' : ''}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-900">Page views</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[#2C3E2D]">{(stats.totals.page_view ?? 0).toLocaleString('en-US')}</p></div>
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-900">Visitors</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[#2C3E2D]">{stats.uniqueVisitors.toLocaleString('en-US')}</p></div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {actions.map((a) => (
              <div key={a.key} className="rounded-lg border border-[#EEF2EC] p-3">
                <dt className="text-xs text-[#6B6560]">{a.label}</dt>
                <dd className="text-lg font-semibold tabular-nums text-[#2C3E2D]">{(stats.totals[a.key] ?? 0).toLocaleString('en-US')}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <p className="text-xs text-[#6B6560]">Page views per day</p>
            <div className="mt-2 flex h-24 items-end gap-px" aria-hidden="true">
              {stats.daily.map((d) => (
                <div key={d.date} title={`${d.date}: ${d.views}`} className="flex-1 rounded-t bg-emerald-700/80" style={{ height: `${d.views === 0 ? 2 : Math.max(6, (d.views / max) * 100)}%`, opacity: d.views === 0 ? 0.25 : 1 }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-[#6B6560]" aria-hidden="true"><span>{stats.from}</span><span>{stats.to}</span></div>
            <p className="sr-only">Busiest day: {[...stats.daily].sort((a, b) => b.views - a.views)[0]?.date} with {max} views.</p>
          </div>
          <p className="mt-3 text-xs text-[#6B6560]">Counts update within a minute. Your own previews are not counted.</p>
        </div>
      )}
    </div>
  );
}
