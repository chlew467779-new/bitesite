'use client';

/**
 * "Send photos of your menu" (CH 2026-09-30), at the top of the dashboard Menu section. Mobile
 * first: one button opens the camera or photo library (several photos at once). Each photo is
 * resized on the phone, keeping the text readable, then: ticket → direct upload with the signed
 * URL → confirm (the server checks the file). The photos stay private; BiteSite adds the menu and
 * then deletes them. Hidden when the feature is not switched on (503 from the route).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MENU_PHOTOS_BUCKET, MENU_PHOTO_MAX_COUNT } from '@/lib/menu-photos-core.mjs';

type Photo = { name: string; uploadedAt: string | null; url: string | null };
type Props = { merchantId: string; getHeaders: () => Promise<Record<string, string> | null>; readOnly: boolean };

export function MenuPhotosPanel({ merchantId, getHeaders, readOnly }: Props) {
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/menu-photos`;
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const headers = await getHeaders();
    if (!headers) return;
    try {
      const r = await fetch(api, { headers, cache: 'no-store' });
      const body = await r.json().catch(() => null);
      if (r.status === 503) { setHidden(true); return; }
      if (!r.ok || !body?.data) { setError(body?.error?.message || 'Could not load your menu photos.'); return; }
      setPhotos(body.data as Photo[]);
    } catch { setError('Could not reach BiteSite. Check your connection.'); }
  }, [api, getHeaders]);
  useEffect(() => { void load(); }, [load]);

  const send = async (files: File[]) => {
    setError(''); setMessage('');
    const room = MENU_PHOTO_MAX_COUNT - (photos?.length ?? 0);
    if (files.length > room) { setError(`You can send ${room} more photo${room === 1 ? '' : 's'} (up to ${MENU_PHOTO_MAX_COUNT}).`); files = files.slice(0, Math.max(room, 0)); }
    if (files.length === 0) return;
    const headers = await getHeaders();
    if (!headers) { setError('Your session has ended. Sign in again.'); return; }
    let sent = 0;
    setProgress({ done: 0, total: files.length });
    try {
      for (const file of files) {
        // Large enough to read small print; JPEG so it opens anywhere.
        const resized = await imageCompression(file, { maxWidthOrHeight: 2400, maxSizeMB: 3, initialQuality: 0.85, fileType: 'image/jpeg', useWebWorker: true });
        const ticketResponse = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ticket', contentType: 'image/jpeg' }) });
        const ticket = await ticketResponse.json().catch(() => null);
        if (!ticketResponse.ok || !ticket?.data) throw new Error(ticket?.error?.message || 'The photo could not be prepared for upload.');
        const { error: uploadError } = await supabase.storage.from(MENU_PHOTOS_BUCKET).uploadToSignedUrl(ticket.data.path as string, ticket.data.token as string, resized, { contentType: 'image/jpeg' });
        if (uploadError) throw new Error('The upload did not finish. Check your connection and try again.');
        const confirmResponse = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', name: ticket.data.name }) });
        const confirmed = await confirmResponse.json().catch(() => null);
        if (!confirmResponse.ok) throw new Error(confirmed?.error?.message || 'The photo could not be saved.');
        sent += 1;
        setProgress({ done: sent, total: files.length });
      }
      setMessage(`${sent} photo${sent === 1 ? '' : 's'} sent. BiteSite will add your menu and let you know on WhatsApp.`);
    } catch (e) {
      setError(`${sent > 0 ? `${sent} photo${sent === 1 ? '' : 's'} sent. ` : ''}${e instanceof Error ? e.message : 'Something went wrong.'}`);
    } finally {
      setProgress(null);
      await load();
    }
  };

  const remove = async (photo: Photo) => {
    if (!window.confirm('Delete this photo?')) return;
    const headers = await getHeaders();
    if (!headers) { setError('Your session has ended. Sign in again.'); return; }
    setError(''); setMessage('');
    const r = await fetch(`${api}?name=${encodeURIComponent(photo.name)}`, { method: 'DELETE', headers });
    const body = await r.json().catch(() => null);
    if (!r.ok) setError(body?.error?.message || 'Could not delete the photo.');
    await load();
  };

  if (hidden) return null;
  const count = photos?.length ?? 0;
  const busy = progress !== null;

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
      <h3 className="text-sm font-semibold text-[#2C3E2D]">Prefer not to type your menu?</h3>
      <p className="mt-1 text-sm text-[#4B4540]">Send clear photos of every page of your menu, with prices. BiteSite will add the dishes for you and tell you on WhatsApp when it is done. Only BiteSite can see these photos.</p>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1}
        onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void send(files); }} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={readOnly || busy || count >= MENU_PHOTO_MAX_COUNT} onClick={() => input.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {busy ? `Sending ${progress.done + 1} of ${progress.total}…` : count > 0 ? 'Add more photos' : 'Send menu photos'}
        </button>
        {count > 0 && <span className="text-sm text-[#6B6560]">{count} of {MENU_PHOTO_MAX_COUNT} photos sent, waiting for BiteSite</span>}
      </div>
      {message && <p role="status" className="mt-2 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {count > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos!.map((photo, index) => (
            <li key={photo.name} className="relative overflow-hidden rounded-lg border border-[#DDE5DC] bg-white">
              {photo.url
                ? (
                  <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Open menu photo ${index + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL */}
                    <img src={photo.url} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  </a>
                )
                : <div className="aspect-[3/4] w-full" />}
              {!readOnly && (
                <button type="button" onClick={() => void remove(photo)} disabled={busy} aria-label={`Delete menu photo ${index + 1}`}
                  className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center bg-white/80 text-red-700 hover:bg-white disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
