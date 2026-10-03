/* bitesite/app/api/_lib/menu-photos.ts */

/**
 * Menu photos (private bucket), shared by the Owner and Admin routes. The caller has authorized
 * the actor for the restaurant. Uploads go to a server-chosen `incoming/` path through a signed
 * upload URL; confirm downloads the file, checks its size and real image type, and only then moves
 * it next to the other photos. Nothing here is public: viewing uses short-lived signed URLs.
 */

import 'server-only';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { sniffImageType } from '@/lib/merchant-media-core.mjs';
import {
  MENU_PHOTOS_BUCKET, MENU_PHOTO_MAX_BYTES, MENU_PHOTO_MAX_COUNT,
  checkedPhotos, contentTypeOfName, incomingPath, isMissingBucketError, merchantFolders, newMenuPhotoName, photoPath,
  type MenuPhoto,
} from '@/lib/menu-photos-core.mjs';

export type PhotoResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string; message: string };

const bucket = () => supabase.storage.from(MENU_PHOTOS_BUCKET);
const STALE_INCOMING_MS = 60 * 60 * 1000;
const VIEW_SECONDS = 60 * 60;
let bucketReady = false;

function failure(error: unknown, label: string): PhotoResult<never> {
  if (isMissingBucketError(error)) return { ok: false, status: 503, code: 'NOT_AVAILABLE', message: 'Sending menu photos is not available yet.' };
  console.error(`menu photos ${label} failed:`, error instanceof Error ? error.message : (error as { message?: string })?.message ?? error);
  return { ok: false, status: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong with the menu photos. Please try again.' };
}

/**
 * The private bucket exists (migration 20261003130000). list() on a missing bucket returns an empty
 * list without an error, so this is checked explicitly; a public bucket is refused outright.
 */
async function ensureBucket(): Promise<PhotoResult<true>> {
  if (bucketReady) return { ok: true, value: true };
  const { data, error } = await supabase.storage.getBucket(MENU_PHOTOS_BUCKET);
  if (error) return failure(error, 'bucket');
  if (data?.public !== false) { console.error('menu photos: the menu-photos bucket is public; refusing to use it'); return { ok: false, status: 500, code: 'INTERNAL_ERROR', message: 'Menu photos are not available right now.' }; }
  bucketReady = true;
  return { ok: true, value: true };
}

/** The restaurant's checked photos, oldest first, each with a signed URL for viewing. */
export async function listMenuPhotos(merchantId: string): Promise<PhotoResult<(MenuPhoto & { url: string | null })[]>> {
  const ready = await ensureBucket();
  if (!ready.ok) return ready;
  const { data, error } = await bucket().list(merchantId.toLowerCase(), { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  if (error) return failure(error, 'list');
  const photos = checkedPhotos(data);
  if (photos.length === 0) return { ok: true, value: [] };
  const { data: signed, error: signError } = await bucket().createSignedUrls(photos.map((p) => photoPath(merchantId, p.name)), VIEW_SECONDS);
  if (signError) return failure(signError, 'sign');
  return { ok: true, value: photos.map((p, i) => ({ ...p, url: signed?.[i]?.signedUrl ?? null })) };
}

/** A signed upload URL for a new photo, while the restaurant has room for more. */
export async function createMenuPhotoTicket(merchantId: string, contentType: string): Promise<PhotoResult<{ name: string; path: string; token: string }>> {
  const ready = await ensureBucket();
  if (!ready.ok) return ready;
  const folder = merchantId.toLowerCase();
  const [{ data: current, error }, { data: incoming }] = await Promise.all([
    bucket().list(folder, { limit: 100 }),
    bucket().list(`${folder}/incoming`, { limit: 100 }),
  ]);
  if (error) return failure(error, 'ticket list');
  if (checkedPhotos(current).length >= MENU_PHOTO_MAX_COUNT) {
    return { ok: false, status: 409, code: 'TOO_MANY_PHOTOS', message: `You can send up to ${MENU_PHOTO_MAX_COUNT} photos at a time. Delete one, or wait until BiteSite has added your menu.` };
  }
  // Uploads that were never confirmed (closed tab, failed check) are cleared after an hour.
  const stale = (incoming ?? []).filter((f) => f.id && f.created_at && Date.now() - Date.parse(f.created_at) > STALE_INCOMING_MS).map((f) => `${folder}/incoming/${f.name}`);
  if (stale.length) await bucket().remove(stale);

  const name = newMenuPhotoName(contentType, crypto.randomUUID());
  if (!name) return { ok: false, status: 400, code: 'VALIDATION_FAILED', message: 'Use a JPEG, PNG or WebP photo.' };
  const path = incomingPath(merchantId, name);
  const { data, error: signError } = await bucket().createSignedUploadUrl(path);
  if (signError || !data) return failure(signError, 'ticket');
  return { ok: true, value: { name, path, token: data.token } };
}

/** Check an uploaded photo (size, real type) and add it; a bad file is deleted. */
export async function confirmMenuPhoto(merchantId: string, name: string): Promise<PhotoResult<MenuPhoto>> {
  const ready = await ensureBucket();
  if (!ready.ok) return ready;
  const from = incomingPath(merchantId, name);
  const { data: file, error } = await bucket().download(from);
  if (error || !file) {
    if (isMissingBucketError(error)) return failure(error, 'confirm');
    return { ok: false, status: 404, code: 'RESOURCE_NOT_FOUND', message: 'The photo did not arrive. Please send it again.' };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MENU_PHOTO_MAX_BYTES || sniffImageType(bytes) !== contentTypeOfName(name)) {
    await bucket().remove([from]);
    return { ok: false, status: 422, code: 'INVALID_IMAGE', message: 'This file is not a photo BiteSite can use (JPEG, PNG or WebP, up to 10 MB).' };
  }
  const { data: current, error: listError } = await bucket().list(merchantId.toLowerCase(), { limit: 100 });
  if (listError) return failure(listError, 'confirm list');
  if (checkedPhotos(current).length >= MENU_PHOTO_MAX_COUNT) {
    await bucket().remove([from]);
    return { ok: false, status: 409, code: 'TOO_MANY_PHOTOS', message: `You can send up to ${MENU_PHOTO_MAX_COUNT} photos at a time.` };
  }
  const { error: moveError } = await bucket().move(from, photoPath(merchantId, name));
  if (moveError) return failure(moveError, 'move');
  return { ok: true, value: { name, uploadedAt: new Date().toISOString(), size: bytes.byteLength } };
}

/** Delete some photos (by checked name), or every file of the restaurant when `names` is null. */
export async function deleteMenuPhotos(merchantId: string, names: string[] | null): Promise<PhotoResult<number>> {
  const ready = await ensureBucket();
  if (!ready.ok) return ready;
  const folder = merchantId.toLowerCase();
  let paths: string[];
  if (names) {
    paths = names.map((n) => photoPath(merchantId, n));
  } else {
    const [{ data: current, error }, { data: incoming }] = await Promise.all([bucket().list(folder, { limit: 100 }), bucket().list(`${folder}/incoming`, { limit: 100 })]);
    if (error) return failure(error, 'delete list');
    paths = [...(current ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`), ...(incoming ?? []).filter((f) => f.id).map((f) => `${folder}/incoming/${f.name}`)];
  }
  if (paths.length === 0) return { ok: true, value: 0 };
  const { data, error } = await bucket().remove(paths);
  if (error) return failure(error, 'delete');
  return { ok: true, value: data?.length ?? 0 };
}

/** Restaurants with checked photos waiting: `{ merchantId, count, oldest }`, oldest first. */
export async function menuPhotoQueue(): Promise<PhotoResult<{ merchantId: string; count: number; oldest: string | null }[]>> {
  const ready = await ensureBucket();
  if (!ready.ok) return ready;
  const { data, error } = await bucket().list('', { limit: 1000 });
  if (error) return failure(error, 'queue');
  const folders = merchantFolders(data);
  const lists = await Promise.all(folders.map((f) => bucket().list(f, { limit: 100 })));
  const queue = folders
    .map((merchantId, i) => ({ merchantId, photos: checkedPhotos(lists[i].data) }))
    .filter((q) => q.photos.length > 0)
    .map((q) => ({ merchantId: q.merchantId, count: q.photos.length, oldest: q.photos[0].uploadedAt }));
  return { ok: true, value: queue.sort((a, b) => String(a.oldest).localeCompare(String(b.oldest))) };
}
