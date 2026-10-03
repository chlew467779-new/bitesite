/* bitesite/app/components/media/profile-image-field.tsx */
'use client';

/**
 * Logo / cover photo control (M6b), shared by the Admin editor and the Merchant dashboard, and
 * dish photos (slot 'dish' + productId; apiBase .../menu/dish-photo).
 * Mobile first: one large "Choose photo" button opens the phone's photo library or camera; the
 * photo is resized and converted to WebP on the device before upload (less data, faster).
 *
 * Flow: ticket (server picks the path) → direct upload with the signed URL → PUT bind, which the
 * server only accepts after checking the stored file. The PUT carries the value this control
 * showed, so a photo changed meanwhile in another session is reported, not overwritten. If the
 * result of the PUT is unknown, Retry resends it with the same request id.
 */

import type { SectionHandle } from '@/app/components/section-save/use-section-save';
import { useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { DISH_RESIZE, MEDIA_RESIZE, type MediaSlot } from '@/lib/merchant-media-core.mjs';

type Props = {
  slot: MediaSlot | 'dish';
  /** Required for slot 'dish'. */
  productId?: string;
  label: string;
  value: string | null;
  /** e.g. `/api/admin/merchants/<id>/media` or `/api/merchant/restaurants/<id>/media` */
  apiBase: string;
  /** Auth headers for the current actor, or null when the session has ended. */
  getHeaders: () => Promise<Record<string, string> | null>;
  onChanged: (value: string | null) => void;
  disabled?: boolean;
  register?: (id: string, handle: SectionHandle | null) => void;
};

type Stage = 'idle' | 'preparing' | 'uploading' | 'checking' | 'removing';
type PendingBind = { requestId: string; uploadId: string | null; expected: string | null } & ({ slot: MediaSlot } | { productId: string });

const STAGE_TEXT: Record<Stage, string> = {
  idle: '',
  preparing: 'Preparing photo…',
  uploading: 'Uploading…',
  checking: 'Checking and saving…',
  removing: 'Removing…',
};

function safeSrc(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

type ApiReply = {
  data?: { value?: string | null; uploadId?: string; bucket?: string; path?: string; token?: string };
  error?: { code?: string; message?: string; current?: string | null };
};

async function json(response: Response): Promise<ApiReply | null> {
  return response.json().catch(() => null);
}

export function ProfileImageField({ slot, productId, label, value, apiBase, getHeaders, onChanged, disabled, register }: Props) {
  const key = slot === 'dish' ? `dish-${productId}` : slot;
  const target = (): { slot: MediaSlot } | { productId: string } => (slot === 'dish' ? { productId: productId as string } : { slot });
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<PendingBind | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    register?.('photo-' + key, { status: () => ({ dirty: false, pending: stage !== 'idle', unknown: !!unknown, conflicts: false }), save: async () => 'skipped', discard: () => {} });
    return () => register?.('photo-' + key, null);
  }, [register, key, stage, unknown]);
  const inputId = `photo-${key}`;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const bind = async (pending: PendingBind, headers: Record<string, string>) => {
    setStage(pending.uploadId ? 'checking' : 'removing');
    let response: Response;
    try {
      response = await fetch(apiBase, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
    } catch {
      setUnknown(pending);
      setMessage({ kind: 'error', text: 'Could not reach BiteSite. Retry sends the same request, so the photo is never changed twice.' });
      return;
    }
    const data = await json(response);
    if (response.status >= 500 || !data) {
      setUnknown(pending);
      setMessage({ kind: 'error', text: 'The result is not confirmed. Retry sends the same request, so the photo is never changed twice.' });
      return;
    }
    setUnknown(null);
    if (response.ok) {
      onChanged(data.data?.value ?? null);
      setMessage({ kind: 'ok', text: pending.uploadId ? `${label} saved.` : `${label} removed.` });
    } else {
      if (data.error?.code === 'FIELD_CONFLICT') onChanged(data.error.current ?? null);
      setMessage({ kind: 'error', text: data.error?.message || 'The photo was not saved.' });
    }
  };

  const run = async (task: (headers: Record<string, string>) => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: 'Your session has ended. Sign in again, then retry.' }); return; }
      await task(headers);
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      busyRef.current = false;
      setStage('idle');
      setPreview(null);
    }
  };

  const choose = (file: File) => run(async (headers) => {
    setStage('preparing');
    setPreview(URL.createObjectURL(file));
    const resized = await imageCompression(file, { ...(slot === 'dish' ? DISH_RESIZE : MEDIA_RESIZE[slot]), initialQuality: 0.82, fileType: 'image/webp', useWebWorker: true });
    const ticketResponse = await fetch(`${apiBase}/ticket`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target(), contentType: 'image/webp', size: resized.size }),
    });
    const ticket = await json(ticketResponse);
    if (!ticketResponse.ok || !ticket?.data) throw new Error(ticket?.error?.message || 'The photo could not be prepared for upload.');
    setStage('uploading');
    const { error } = await supabase.storage.from(ticket.data.bucket as string).uploadToSignedUrl(ticket.data.path as string, ticket.data.token as string, resized, { contentType: 'image/webp' });
    if (error) throw new Error('The upload did not finish. Check your connection and choose the photo again.');
    await bind({ requestId: crypto.randomUUID(), ...target(), uploadId: ticket.data.uploadId as string, expected: value }, headers);
  });

  const remove = () => { setConfirmRemove(false); void run((headers) => bind({ requestId: crypto.randomUUID(), ...target(), uploadId: null, expected: value }, headers)); };
  const retry = () => { if (unknown) { const pending = unknown; void run((headers) => bind(pending, headers)); } };

  const busy = stage !== 'idle';
  const src = preview ?? safeSrc(value);
  const locked = disabled || busy || !!unknown;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#2C3E2D]">{label}</p>
      <div className={`relative overflow-hidden rounded-xl border border-[#DDE5DC] bg-[#F4F6F1] ${slot === 'cover' ? 'aspect-[16/9] w-full' : slot === 'dish' ? 'aspect-[4/3] w-full max-w-xs' : 'aspect-square w-32'}`}>
        {src
          ? // eslint-disable-next-line @next/next/no-img-element -- upload preview uses blob URLs and short-lived signed URLs
          <img src={src} alt={label} className={`h-full w-full object-cover ${busy ? 'opacity-60' : ''}`} />
          : <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#6B6560]">No {label.toLowerCase()}</div>}
        {busy && <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-xs font-medium text-white" role="status">{STAGE_TEXT[stage]}</div>}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId}
          className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium sm:w-auto ${slot === 'dish' ? 'border border-[#2C3E2D] bg-white text-[#2C3E2D]' : 'bg-[#2C3E2D] text-white'} ${locked ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
          {value ? 'Change photo' : 'Choose photo'}
        </label>
        {/* JPEG/PNG/WebP only: phones convert HEIC photos to JPEG for these types. */}
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={locked}
          onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void choose(file); }} />
        {value && !confirmRemove && (
          <button type="button" disabled={locked} onClick={() => setConfirmRemove(true)}
            className="min-h-11 w-full rounded-lg border border-red-700 px-4 text-sm font-medium text-red-700 disabled:opacity-50 sm:w-auto">
            Remove
          </button>
        )}
        {confirmRemove && (
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" onClick={remove} className="min-h-11 flex-1 rounded-lg bg-red-700 px-4 text-sm font-medium text-white sm:flex-none">Remove {label.toLowerCase()}</button>
            <button type="button" onClick={() => setConfirmRemove(false)} className="min-h-11 flex-1 rounded-lg border border-[#C9D6C7] px-4 text-sm font-medium sm:flex-none">Keep</button>
          </div>
        )}
      </div>
      {unknown && (
        <button type="button" disabled={busy} onClick={retry} className="min-h-11 w-full rounded-lg border border-[#2C3E2D] px-4 text-sm font-medium disabled:opacity-50 sm:w-auto">
          {busy ? 'Retrying…' : 'Retry'}
        </button>
      )}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
