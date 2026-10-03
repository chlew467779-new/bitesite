'use client';

/**
 * Monthly summaries (CH 2026-09-30): at the start of a month, send each live restaurant last
 * month's numbers by one-tap WhatsApp. Nothing is sent automatically; "Sent" ticks are kept in
 * this browser only, per month.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { useAuth } from './auth-context';
import NotifyMerchant, { type Notice } from './notify-merchant';
import { changeWords, type SummaryRange, type SummaryTotals } from '@/lib/monthly-summary-core.mjs';

type Item = { merchantId: string; name: string; slug: string; hasPhone: boolean; lastMonth: SummaryTotals; monthBefore: SummaryTotals };
type Data = { lastMonth: SummaryRange & { key: string }; monthBefore: SummaryRange; items: Item[] };

const sentKey = (month: string) => `bitesite.admin.summary-sent.${month}`;
function readSent(month: string): string[] {
  try { const value = JSON.parse(localStorage.getItem(sentKey(month)) ?? '[]'); return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []; } catch { return []; }
}
function writeSent(month: string, ids: string[]) {
  try { localStorage.setItem(sentKey(month), JSON.stringify(ids)); } catch { /* ticks are a convenience only */ }
}

export default function MonthlySummaries() {
  const { token } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<string[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/monthly-summaries', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await r.json();
      if (!r.ok || !body.data) throw new Error(body.error?.message || 'Could not load the summaries.');
      setData(body.data as Data);
      setSent(readSent((body.data as Data).lastMonth.key));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the summaries.'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const toggleSent = (id: string, value: boolean) => {
    if (!data) return;
    const next = value ? [...new Set([...sent, id])] : sent.filter((s) => s !== id);
    setSent(next); writeSent(data.lastMonth.key, next);
  };
  const prepare = (item: Item) => {
    if (!data) return;
    const notice: Notice = {
      key: item.merchantId, merchantId: item.merchantId, kind: 'monthly_summary', label: `${item.name}: ${data.lastMonth.label} summary`,
      summary: { label: data.lastMonth.label, previousLabel: data.monthBefore.label, current: item.lastMonth, previous: item.monthBefore },
    };
    setNotices((list) => [notice, ...list.filter((n) => n.key !== notice.key)]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const items = data?.items ?? [];
  const remaining = items.filter((i) => !sent.includes(i.merchantId)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Monthly summaries</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data ? `Send each live restaurant its numbers for ${data.lastMonth.label}, compared with ${data.monthBefore.label}.` : 'Send each live restaurant its numbers for last month.'}
            {' '}Tap a restaurant, check the message, then press send in WhatsApp.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:border-slate-500"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <NotifyMerchant notices={notices} onDone={(key) => { setNotices((list) => list.filter((n) => n.key !== key)); toggleSent(key, true); }} />

      {loading && <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>}
      {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      {!loading && data && items.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">No live restaurants yet.</p>}
      {!loading && items.length > 0 && (
        <>
          <p className="text-sm text-slate-400" role="status">{remaining === 0 ? 'All summaries are marked as sent.' : `${remaining} of ${items.length} still to send.`} Daily totals refresh every hour.</p>
          <ul className="space-y-3">
            {items.map((item) => {
              const done = sent.includes(item.merchantId);
              const change = changeWords(item.lastMonth.views, item.monthBefore.views);
              return (
                <li key={item.merchantId} className={`rounded-xl border p-4 ${done ? 'border-slate-800 bg-slate-900/30' : 'border-slate-700 bg-slate-900/60'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-white">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        <strong className="text-white">{item.lastMonth.views}</strong> page views{change && <span className="text-slate-400"> ({change})</span>}
                        {' · '}<strong className="text-white">{item.lastMonth.contacts}</strong> contacts
                        {' · '}<strong className="text-white">{item.lastMonth.menuViews}</strong> menu views
                      </p>
                      {!item.hasPhone && <p className="mt-1 text-xs text-amber-300">No WhatsApp or phone number: copy the message or email the owner.</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={done} onChange={(e) => toggleSent(item.merchantId, e.target.checked)} className="h-4 w-4" />Sent
                      </label>
                      <button type="button" onClick={() => prepare(item)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"><MessageCircle className="h-4 w-4" />Prepare message</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
