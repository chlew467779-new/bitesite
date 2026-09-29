'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import ImageUpload from './image-upload';
import { ANNOUNCEMENT_LIMITS, isAnnouncementLive } from '@/lib/announcement-core.mjs';

/** Homepage pop-up manager: one pop-up is on at a time; each visitor sees it once. */

interface Announcement {
  id: string; title: string | null; body: string | null; image_url: string | null;
  link_url: string | null; link_label: string | null; is_active: boolean;
  starts_at: string | null; ends_at: string | null; created_at: string;
}
type Form = { title: string; body: string; imageUrl: string; linkLabel: string; linkUrl: string; startsAt: string; endsAt: string; isActive: boolean };

const EMPTY: Form = { title: '', body: '', imageUrl: '', linkLabel: '', linkUrl: '', startsAt: '', endsAt: '', isActive: false };
const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none';
const labelClass = 'mb-1 block text-sm font-medium text-slate-200';
const buttonClass = 'min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-950 disabled:opacity-50';
const ghostClass = 'min-h-11 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 disabled:opacity-50';

// datetime-local works in the browser's time zone; the API stores ISO time.
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const fromRow = (a: Announcement): Form => ({
  title: a.title ?? '', body: a.body ?? '', imageUrl: a.image_url ?? '', linkLabel: a.link_label ?? '', linkUrl: a.link_url ?? '',
  startsAt: toLocalInput(a.starts_at), endsAt: toLocalInput(a.ends_at), isActive: a.is_active,
});
const statusOf = (a: Announcement) => {
  if (isAnnouncementLive(a)) return { text: 'Showing now', cls: 'bg-emerald-500/15 text-emerald-300' };
  if (!a.is_active) return { text: 'Off', cls: 'bg-slate-700 text-slate-300' };
  if (a.ends_at && Date.parse(a.ends_at) <= Date.now()) return { text: 'Ended', cls: 'bg-slate-700 text-slate-300' };
  return { text: 'Scheduled', cls: 'bg-sky-500/15 text-sky-300' };
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function AnnouncementsManager() {
  const { token } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const call = useCallback(async (method: string, payload?: object) => {
    const response = await fetch('/api/admin/announcements', {
      method,
      headers: { 'x-admin-token': token ?? '', ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Something went wrong.');
    return body;
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try { setItems((await call('GET')).announcements || []); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load pop-ups.'); }
    finally { setLoading(false); }
  }, [token, call]);
  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await load(); setMessage(done); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Something went wrong.'); return false; }
    finally { setBusy(false); }
  };

  const payload = () => ({
    title: form.title, body: form.body, imageUrl: form.imageUrl, linkLabel: form.linkLabel, linkUrl: form.linkUrl,
    startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt), isActive: form.isActive,
  });
  const save = async () => {
    const ok = await run(() => (editingId === 'new' ? call('POST', payload()) : call('PUT', { id: editingId, ...payload() })), 'Pop-up saved.');
    if (ok) { setEditingId(null); setForm(EMPTY); }
  };
  const toggle = (a: Announcement) => run(
    () => call('PUT', { id: a.id, title: a.title, body: a.body, imageUrl: a.image_url, linkLabel: a.link_label, linkUrl: a.link_url, startsAt: a.starts_at, endsAt: a.ends_at, isActive: !a.is_active }),
    a.is_active ? 'Pop-up turned off.' : 'Pop-up turned on. Any other pop-up was turned off.',
  );
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Homepage pop-up</h2>
            <p className="mt-1 text-sm text-slate-400">Shows once to each visitor on the homepage. Only one pop-up is on at a time.</p>
          </div>
          {editingId === null && <button type="button" className={buttonClass} onClick={() => { setEditingId('new'); setForm(EMPTY); setMessage(''); }}>New pop-up</button>}
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p>}
      </div>

      {editingId !== null && (
        <div className="grid gap-6 rounded-xl border border-slate-800 bg-slate-900 p-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <ImageUpload kind="story" label="Image (optional)" value={form.imageUrl} onChange={(v) => set('imageUrl', v)} help="Any shape works; tall images are shown whole." />
            {form.imageUrl && <button type="button" className="text-sm text-slate-400 underline" onClick={() => set('imageUrl', '')}>Remove image</button>}
            <div>
              <label className={labelClass} htmlFor="popup-title">Title {form.imageUrl ? '(optional)' : ''}</label>
              <input id="popup-title" className={inputClass} maxLength={ANNOUNCEMENT_LIMITS.title} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Merdeka week: free kopi at 10 partner cafés" />
            </div>
            <div>
              <label className={labelClass} htmlFor="popup-body">Text (optional)</label>
              <textarea id="popup-body" rows={3} className={inputClass} maxLength={ANNOUNCEMENT_LIMITS.body} value={form.body} onChange={(e) => set('body', e.target.value)} />
              <p className="mt-1 text-right text-xs text-slate-500">{form.body.length}/{ANNOUNCEMENT_LIMITS.body}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="popup-label">Button text (optional)</label>
                <input id="popup-label" className={inputClass} maxLength={ANNOUNCEMENT_LIMITS.linkLabel} value={form.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} placeholder="e.g. See the cafés" />
              </div>
              <div>
                <label className={labelClass} htmlFor="popup-link">Button link</label>
                <input id="popup-link" className={inputClass} value={form.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="/stories or https://…" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="popup-start">Start (optional)</label>
                <input id="popup-start" type="datetime-local" className={inputClass} value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="popup-end">End (optional)</label>
                <input id="popup-end" type="datetime-local" className={inputClass} value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-200">
              <input type="checkbox" className="h-5 w-5" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Turn on (other pop-ups turn off)
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className={ghostClass} disabled={busy} onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel</button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Preview (phone size)</p>
            <div className="overflow-hidden rounded-2xl bg-white text-left shadow-xl">
              {form.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file
                <img src={form.imageUrl} alt="" className="block max-h-80 w-full bg-[#F0F4EC] object-contain" />
              )}
              <div className="space-y-2 p-4">
                {form.title && <p className="text-base font-semibold text-[#2C3E2D]">{form.title}</p>}
                {form.body && <p className="whitespace-pre-line text-sm text-[#5C6B5D]">{form.body}</p>}
                {form.linkLabel && <p className="rounded-full bg-[#5A8F6E] py-2 text-center text-sm font-medium text-white">{form.linkLabel}</p>}
                <p className="py-1 text-center text-sm text-[#5C6B5D]">Close</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        {loading ? <p className="p-5 text-sm text-slate-400">Loading…</p> : items.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No pop-ups yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((a) => {
              const status = statusOf(a);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.text}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{a.title || '(image only)'}</p>
                    <p className="text-xs text-slate-500">
                      {a.starts_at || a.ends_at ? `${when(a.starts_at) || 'Now'} → ${when(a.ends_at) || 'no end'}` : 'No schedule'} · created {when(a.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={ghostClass} disabled={busy} onClick={() => void toggle(a)}>{a.is_active ? 'Turn off' : 'Turn on'}</button>
                    <button type="button" className={ghostClass} disabled={busy} onClick={() => { setEditingId(a.id); setForm(fromRow(a)); setMessage(''); }}>Edit</button>
                    {confirmDelete === a.id ? (
                      <>
                        <button type="button" className="min-h-11 rounded-lg bg-red-600 px-4 text-sm text-white" disabled={busy} onClick={() => void run(() => call('DELETE', { id: a.id }), 'Pop-up deleted.').then(() => setConfirmDelete(null))}>Delete</button>
                        <button type="button" className={ghostClass} onClick={() => setConfirmDelete(null)}>Keep</button>
                      </>
                    ) : (
                      <button type="button" className={ghostClass} disabled={busy} onClick={() => setConfirmDelete(a.id)}>Delete…</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
