'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth-context';
import NotificationStatus from './notification-status';
import type { IntakeMode, ReviewItem } from '@/lib/merchant-review-core.mjs';

type Queue = { intakeMode: IntakeMode; capacity: number; pending: number; pilotCapacity: number; pilotUsed: number; items: ReviewItem[] };
const MODES: { value: IntakeMode; label: string; hint: string }[] = [
  { value: 'open', label: 'Open', hint: 'Any number of restaurants can join.' },
  { value: 'limited', label: 'Limited', hint: 'Stop new submissions when the pilot limit is reached.' },
  { value: 'paused', label: 'Paused', hint: 'Nobody can submit. Drafts, waiting reviews and live restaurants are not affected.' },
];
type Decision = { requestId: string; submissionId: string; decision: 'approve' | 'reject'; note: string | null };
const btn = 'min-h-11 w-full rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 sm:w-auto';
function imageUrl(value: string | null) {
  try { const u = new URL(value || ''); return ['http:', 'https:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; }
}
export default function RestaurantReviewQueue() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [capacity, setCapacity] = useState('20');
  const [pilotCapacity, setPilotCapacity] = useState('50');
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('limited');
  // Shown under Save: on a phone the page-level messages are off-screen by then.
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [unknown, setUnknown] = useState<Decision | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch('/api/admin/restaurant-reviews', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await r.json();
      if (!r.ok || !body.data) throw new Error(body.error?.message || 'Could not load reviews.');
      setQueue(body.data); setCapacity(String(body.data.capacity)); setPilotCapacity(String(body.data.pilotCapacity)); setIntakeMode(body.data.intakeMode ?? 'limited');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not reach BiteSite.'); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  const decide = async (payload: Decision) => {
    if (!token || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const r = await fetch('/api/admin/restaurant-reviews', { method: 'POST', headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await r.json().catch(() => null);
      if (r.status >= 500 || !body || (r.ok && !body.data)) { setUnknown(payload); setError('Decision not confirmed. Retry sends the same decision and note.'); return; }
      setUnknown(null);
      if (!r.ok) { setError(body.error?.message || 'Decision was not saved.'); return; }
      setNotice(payload.decision === 'approve' ? 'Approved. The restaurant stays hidden until its Owner publishes.' : 'Changes requested. The Owner can see your note.');
      await load();
    } catch { setUnknown(payload); setError('Could not confirm the result. Retry the same decision.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const submitDecision = (item: ReviewItem, decision: 'approve' | 'reject') => {
    const note = notes[item.id]?.trim() || null;
    if (decision === 'reject' && !note) { setError('Write a reason for the restaurant before rejecting.'); return; }
    void decide({ requestId: crypto.randomUUID(), submissionId: item.id, decision, note });
  };
  const saveCapacity = async () => {
    const n = Number(capacity), p = Number(pilotCapacity);
    if (!token || busyRef.current) return;
    if (!capacity.trim() || !Number.isInteger(n) || n < 1 || n > 1000) { setSettingsMsg({ ok: false, text: 'Waiting-for-review limit: enter a whole number from 1 to 1000.' }); return; }
    if (intakeMode === 'limited' && (!pilotCapacity.trim() || !Number.isInteger(p) || p < 1 || p > 100000)) { setSettingsMsg({ ok: false, text: 'Pilot limit: enter a whole number from 1 to 100000.' }); return; }
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const r = await fetch('/api/admin/restaurant-reviews', { method: 'PUT', headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ capacity: n, intakeMode, ...(intakeMode === 'limited' ? { pilotCapacity: p } : {}) }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error?.message || 'Could not save the settings.');
      setSettingsMsg({ ok: true, text: intakeMode === 'paused' ? 'Saved: Paused. New restaurants cannot submit; nothing else changed.' : 'Saved. Existing restaurants and waiting submissions are kept.' }); await load();
    } catch (e) { setSettingsMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not confirm the settings. Save again to retry.' }); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold text-slate-100">Restaurant Reviews</h2><p className="mt-1 text-sm text-slate-400">Review the submitted restaurant details. Approval lets the Owner publish when ready.</p></div>
    <NotificationStatus />
    {error && <p role="alert" className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {unknown && <button className={`${btn} text-amber-200`} disabled={busy} onClick={() => void decide(unknown)}>Retry {unknown.decision}</button>}
    <button className={`${btn} text-slate-200`} disabled={busy || !!unknown} onClick={() => { setError(''); void load(); }}>Refresh queue</button>
    {queue && <section className="rounded-xl border border-slate-700 p-4 text-slate-200">
      <h3 className="font-semibold">New restaurants</h3>
      <p className="mt-1 text-sm text-slate-300">
        {queue.intakeMode === 'paused' ? 'Paused: nobody can submit right now.' : queue.intakeMode === 'open' ? `Open: ${queue.pilotUsed} restaurants in the pilot, no limit.` : `Limited: ${queue.pilotUsed} of ${queue.pilotCapacity} pilot places used.`}
        {' '}Waiting for review: {queue.pending} of {queue.capacity}.
      </p>
      <fieldset className="mt-4">
        <legend className="sr-only">Who can submit a new restaurant</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((mode) => (
            <label key={mode.value} className={`flex min-h-11 cursor-pointer gap-3 rounded-lg border p-3 text-sm ${intakeMode === mode.value ? 'border-amber-500 bg-amber-500/10' : 'border-slate-600'}`}>
              <input type="radio" name="intake-mode" value={mode.value} checked={intakeMode === mode.value} onChange={() => { setIntakeMode(mode.value); setSettingsMsg(null); }} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500" />
              <span><span className="block font-medium text-slate-100">{mode.label}</span><span className="block text-xs text-slate-400">{mode.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {intakeMode === 'limited' && <label className="text-sm">Pilot limit (live + waiting restaurants)<input type="number" inputMode="numeric" min={1} max={100000} value={pilotCapacity} onChange={(e) => setPilotCapacity(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>}
        {intakeMode !== 'paused' && <label className="text-sm">Most restaurants waiting for review at once<input type="number" inputMode="numeric" min={1} max={1000} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>}
      </div><button className={`${btn} mt-3`} disabled={busy || !!unknown} onClick={() => void saveCapacity()}>Save</button>
      {settingsMsg && <p role={settingsMsg.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${settingsMsg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{settingsMsg.text}</p>}
      <p className="mt-2 text-xs text-slate-400">Approved and hidden restaurants keep their pilot place. Changing this never cancels a waiting submission.</p>
    </section>}
    {queue?.items.length === 0 && <p className="text-slate-400">No restaurants are waiting for review.</p>}
    {queue && queue.pending > queue.items.length && <p className="text-sm text-slate-400">Showing the oldest {queue.items.length} of {queue.pending}. Review these, then refresh for more.</p>}
    {queue?.items.map((item) => <article key={item.id} className="min-w-0 rounded-xl bg-white p-4 text-[#2C3E2D] sm:p-6">
      <h3 className="break-words text-xl font-semibold">{item.snapshot.name}</h3>
      <p className="mt-1 text-xs text-[#6B6560]">Submitted {new Date(item.createdAt).toLocaleString()}</p>
      <a href={`/merchant/preview?merchant=${encodeURIComponent(item.merchantId)}&as=admin`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-[#2C3E2D] px-3 text-sm font-medium">Preview page</a>
      {item.changed && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Content changed after submission. Ask the Owner to correct and resubmit; approval is blocked.</p>}
      {item.restriction !== 'none' && <p className="mt-2 text-sm text-red-700">Restaurant is {item.restriction}. Publishing remains blocked.</p>}
      <div className="mt-3 flex flex-wrap gap-3">{(['logoImage', 'coverImage'] as const).map((key) => imageUrl(item.snapshot[key]) && <img key={key} src={imageUrl(item.snapshot[key])} alt={key === 'logoImage' ? 'Restaurant logo' : 'Restaurant cover'} className="h-24 w-32 rounded-lg object-cover" />)}</div>
      <dl className="my-4 space-y-2 break-words text-sm">
        <div><dt className="font-semibold">Address</dt><dd>{item.snapshot.address} {item.snapshot.area}</dd></div>
        <div><dt className="font-semibold">Contact</dt><dd>{[item.snapshot.phone, item.snapshot.whatsapp, item.snapshot.email].filter(Boolean).join(' · ')}</dd></div>
        <div><dt className="font-semibold">Cuisine</dt><dd>{item.snapshot.cuisine?.join(', ')}</dd></div>
        <div><dt className="font-semibold">About</dt><dd className="whitespace-pre-wrap">{item.snapshot.tagline}<br />{item.snapshot.description}</dd></div>
      </dl>
      <h4 className="font-semibold">Submitted menu</h4>
      {item.snapshot.menu.categories.map((category) => <div key={category.id} className="mt-2 rounded-lg border p-3"><p className="font-medium">{category.name}</p><ul className="mt-1 space-y-2 text-sm">{item.snapshot.menu.products.filter((p) => p.categoryId === category.id).map((p) => <li key={p.id} className="break-words"><p>{p.name} — {p.price == null ? 'No price' : `RM ${p.price.toFixed(2)}`}{p.discountPrice != null ? ` (offer RM ${p.discountPrice.toFixed(2)})` : ''}{p.isAvailable ? '' : ' · Sold out'}{p.showPrices ? '' : ' · Price hidden'}</p>{p.description && <p className="text-[#6B6560]">{p.description}</p>}</li>)}</ul></div>)}
      <label className="mt-4 block text-sm font-medium">Note for {item.snapshot.name} (required to reject)<textarea maxLength={1000} rows={3} value={notes[item.id] || ''} disabled={busy || !!unknown} onChange={(e) => setNotes((v) => ({ ...v, [item.id]: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#C9D6C7] p-3 text-base font-normal" /></label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><button className={`${btn} bg-[#2C3E2D] text-white`} disabled={busy || !!unknown || item.changed || item.restriction === 'archived'} onClick={() => submitDecision(item, 'approve')}>Approve</button><button className={`${btn} border-red-700 text-red-700`} disabled={busy || !!unknown} onClick={() => submitDecision(item, 'reject')}>Reject with note</button></div>
    </article>)}
  </div>;
}
