'use client';

/**
 * Menu photos from restaurants (CH 2026-09-30): look at the photos, add the menu with "Import a
 * menu from photos" (Merchant Manager → restaurant → Menu), then press Done: the photos are
 * deleted and a one-tap WhatsApp message tells the restaurant its menu is online.
 * "Open Menu" jumps straight to that restaurant's Menu tab; Done with no dishes asks again (T4, T5).
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Images, Loader2, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { useAuth } from './auth-context';
import NotifyMerchant, { type Notice } from './notify-merchant';

type Item = { merchantId: string; name: string; slug: string; count: number; oldest: string | null; dishes?: number | null };
type Photo = { name: string; uploadedAt: string | null; url: string | null };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

export default function MenuPhotosQueue({ onOpenMenu }: { onOpenMenu?: (merchantId: string) => void }) {
  const { token } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const r = await fetch('/api/admin/menu-photos', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await r.json();
      if (!r.ok || !body.data) throw new Error(body.error?.message || 'Could not load the menu photos.');
      setAvailable(body.data.available !== false);
      setItems(body.data.items as Item[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the menu photos.'); setItems([]); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const show = async (item: Item) => {
    if (!token) return;
    if (open === item.merchantId) { setOpen(null); return; }
    setOpen(item.merchantId); setError('');
    try {
      const r = await fetch(`/api/admin/menu-photos?merchantId=${encodeURIComponent(item.merchantId)}`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await r.json();
      if (!r.ok || !body.data) throw new Error(body.error?.message || 'Could not load the photos.');
      setPhotos((p) => ({ ...p, [item.merchantId]: body.data.photos as Photo[] }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the photos.'); }
  };

  const done = async (item: Item) => {
    if (!token) return;
    if (item.dishes === 0 && !window.confirm(`${item.name} has no dishes on its menu yet. Press OK only if you really want to finish without adding the menu.`)) return;
    if (!window.confirm(`Delete the ${item.count} menu photo(s) from ${item.name}? Do this after the menu is added.`)) return;
    setBusy(item.merchantId); setError('');
    try {
      const r = await fetch(`/api/admin/menu-photos?merchantId=${encodeURIComponent(item.merchantId)}`, { method: 'DELETE', headers: { 'x-admin-token': token } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error?.message || 'Could not delete the photos.');
      setItems((list) => (list ?? []).filter((i) => i.merchantId !== item.merchantId));
      setNotices((list) => [{ key: item.merchantId, merchantId: item.merchantId, kind: 'menu_added', label: `${item.name}: menu added` }, ...list.filter((n) => n.key !== item.merchantId)]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the photos.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Menu photos</h1>
          <p className="mt-1 text-sm text-slate-400">Restaurants that sent photos of their menu. Add the menu in Merchant Manager → the restaurant → Menu → <em>Import a menu from photos</em>, check it, then press Done here.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:border-slate-500"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <NotifyMerchant notices={notices} onDone={(key) => setNotices((list) => list.filter((n) => n.key !== key))} />
      {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      {!available && <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200">Menu photos are not switched on yet: the database update for them has not been run.</p>}
      {items === null && <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>}
      {items && items.length === 0 && available && <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">No menu photos waiting.</p>}

      <ul className="space-y-3">
        {(items ?? []).map((item) => (
          <li key={item.merchantId} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-white">{item.name}</p>
                <p className="mt-1 text-sm text-slate-400">{item.count} photo{item.count === 1 ? '' : 's'} · first sent {when(item.oldest)} · /{item.slug}</p>
                {typeof item.dishes === 'number' && <p className={`mt-1 text-sm ${item.dishes === 0 ? 'font-medium text-amber-300' : 'text-slate-300'}`}>{item.dishes === 0 ? 'No dishes on the menu yet' : `${item.dishes} dish${item.dishes === 1 ? '' : 'es'} on the menu now`}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void show(item)} aria-expanded={open === item.merchantId} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 hover:border-slate-400"><Images className="h-4 w-4" />{open === item.merchantId ? 'Hide photos' : 'Show photos'}</button>
                {onOpenMenu && <button type="button" onClick={() => onOpenMenu(item.merchantId)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 hover:border-slate-400"><UtensilsCrossed className="h-4 w-4" />Open Menu</button>}
                <button type="button" onClick={() => void done(item)} disabled={busy === item.merchantId} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"><Check className="h-4 w-4" />Done, menu added</button>
              </div>
            </div>
            {open === item.merchantId && (
              <div className="mt-3">
                {!photos[item.merchantId] && <Loader2 className="h-5 w-5 animate-spin text-amber-500" />}
                {photos[item.merchantId] && (
                  <>
                    <p className="text-xs text-slate-500">Tap a photo to open it full size, then save it to give to Gemini. Links work for one hour.</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {photos[item.merchantId].map((photo, index) => photo.url && (
                        <a key={photo.name} href={photo.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-lg border border-slate-700 hover:border-amber-500">
                          {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL, shown as is */}
                          <img src={photo.url} alt={`Menu photo ${index + 1} from ${item.name}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-2 py-1 text-xs text-white">Photo {index + 1}<ExternalLink className="h-3.5 w-3.5" /></span>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
