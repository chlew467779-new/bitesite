/**
 * M6b trusted profile images (logo / cover), shared by the Admin and Owner routes and the image
 * control. The database (public.merchant_media_ticket / merchant_media_bind) authorizes and binds;
 * the server checks the stored bytes with sniffImageType before binding.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const MEDIA_SLOTS = Object.freeze(["logo", "cover"]);
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_BUCKET = "merchant-media";
export const MEDIA_TYPES = Object.freeze({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" });
export const MAX_MEDIA_BODY_BYTES = 4 * 1024;
/** Client-side resize targets: small enough for phones on mobile data, sharp enough for the page. */
export const MEDIA_RESIZE = Object.freeze({ logo: { maxWidthOrHeight: 512 }, cover: { maxWidthOrHeight: 1600 } });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const onlyKeys = (body, keys) => body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).every((key) => keys.includes(key));

/** `{ slot, contentType, size }` for an upload ticket. */
export function parseTicketRequest(body) {
  if (!onlyKeys(body, ["slot", "contentType", "size"])) return invalid("Invalid request.");
  if (!MEDIA_SLOTS.includes(body.slot)) return invalid("Choose the logo or the cover photo.");
  if (!Object.hasOwn(MEDIA_TYPES, body.contentType)) return invalid("Only JPG, PNG and WebP photos are supported.");
  if (!Number.isSafeInteger(body.size) || body.size <= 0) return invalid("The photo is empty.");
  if (body.size > MEDIA_MAX_BYTES) return { ok: false, status: 413, code: "VALIDATION_FAILED", message: "The photo must be smaller than 5 MB." };
  return { ok: true, slot: body.slot, contentType: body.contentType };
}

/** `{ requestId, slot, uploadId | null, expected: string | null }` to set or remove a photo. */
export function parseBindRequest(body) {
  if (!onlyKeys(body, ["requestId", "slot", "uploadId", "expected"])) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (!MEDIA_SLOTS.includes(body.slot)) return invalid("Choose the logo or the cover photo.");
  if (!(body.uploadId === null || (typeof body.uploadId === "string" && UUID_PATTERN.test(body.uploadId)))) return invalid("Invalid upload.");
  if (!(body.expected === null || (typeof body.expected === "string" && body.expected.length <= 2048))) return invalid("Invalid current value.");
  return { ok: true, requestId: body.requestId, slot: body.slot, uploadId: body.uploadId, expected: body.expected };
}

/** The real image type from the first bytes, or null. */
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Server-chosen object path for a ticket. */
export function mediaObjectPath(merchantId, slot, contentType, uuid) {
  return `profile/${merchantId}/${slot}/${uuid}.${MEDIA_TYPES[contentType]}`;
}

const UPLOAD_DETAIL = Object.freeze({
  upload_used: "This photo was already used. Please choose the photo again.",
  upload_expired: "The upload took too long. Please choose the photo again.",
});

/** Map a PostgREST/RPC error; media-specific codes first, then the shared field-save codes. */
export function mapMediaRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001" && code === "RATE_LIMITED") return { status: 429, code, message: "Too many photo uploads for this restaurant. Please try again in an hour." };
  if (error?.code === "P0001" && code === "VALIDATION_FAILED" && Object.hasOwn(UPLOAD_DETAIL, detail)) return { status: 409, code, message: UPLOAD_DETAIL[detail] };
  if (error?.code === "P0001" && code === "RESOURCE_NOT_FOUND" && detail === "upload") return { status: 409, code: "VALIDATION_FAILED", message: "This upload does not belong to this photo. Please choose the photo again." };
  return mapFieldRpcError(error);
}

/** Turn the bind RPC result into `{ status, body }`. */
export function mediaBindResponse(result, requestId) {
  const replayed = result?.replayed === true;
  if (result?.status === "conflict") {
    return { status: 409, body: { error: { code: "FIELD_CONFLICT", message: "This photo was changed in another session. The latest photo is shown now; choose again if you still want to change it.", current: result.current ?? null }, requestId, replayed } };
  }
  if (result?.status === "applied" || result?.status === "noop") {
    return { status: 200, body: { data: { status: result.status, slot: result.slot, value: result.value ?? null }, revision: result.revision ?? null, requestId, replayed } };
  }
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected result." }, requestId } };
}
