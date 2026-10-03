/**
 * Menu photos from restaurant owners (CH 2026-09-30): rules shared by the Owner and Admin routes,
 * the dashboard panel and scripts/test-menu-photos.mjs. Photos live in the private `menu-photos`
 * bucket (migration 20261003130000): `<merchant id>/incoming/<uuid>.<ext>` right after upload,
 * `<merchant id>/<uuid>.<ext>` once the server has checked the file. BiteSite deletes them after
 * adding the menu.
 */

export const MENU_PHOTOS_BUCKET = "menu-photos";
export const MENU_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** Photos waiting per restaurant; enough for a long printed menu. */
export const MENU_PHOTO_MAX_COUNT = 12;
export const MENU_PHOTO_TYPES = Object.freeze({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" });
export const MAX_MENU_PHOTO_BODY_BYTES = 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE_NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/;
const invalid = (message = "Invalid request.") => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** A checked photo's file name (`<uuid>.<ext>`), the only names a client may refer to. */
export function isMenuPhotoName(value) {
  return typeof value === "string" && FILE_NAME.test(value);
}

export function incomingPath(merchantId, name) {
  return `${merchantId.toLowerCase()}/incoming/${name}`;
}

export function photoPath(merchantId, name) {
  return `${merchantId.toLowerCase()}/${name}`;
}

/** A new server-chosen file name for a content type, or null for a type that is not allowed. */
export function newMenuPhotoName(contentType, uuid) {
  const ext = MENU_PHOTO_TYPES[contentType];
  return ext && UUID.test(uuid) ? `${uuid}.${ext}` : null;
}

/** The content type a checked file name must have. */
export function contentTypeOfName(name) {
  const ext = FILE_NAME.exec(name)?.[2];
  return Object.keys(MENU_PHOTO_TYPES).find((type) => MENU_PHOTO_TYPES[type] === ext) ?? null;
}

/** Owner POST body: `{ action: 'ticket', contentType }` or `{ action: 'confirm', name }`. */
export function parseMenuPhotoRequest(body) {
  if (!isObject(body)) return invalid();
  if (body.action === "ticket") {
    if (Object.keys(body).some((k) => !["action", "contentType"].includes(k))) return invalid();
    if (!Object.hasOwn(MENU_PHOTO_TYPES, body.contentType)) return invalid("Use a JPEG, PNG or WebP photo.");
    return { ok: true, action: "ticket", contentType: body.contentType };
  }
  if (body.action === "confirm") {
    if (Object.keys(body).some((k) => !["action", "name"].includes(k)) || !isMenuPhotoName(body.name)) return invalid();
    return { ok: true, action: "confirm", name: body.name };
  }
  return invalid("Unknown action.");
}

/**
 * The checked photos in one restaurant folder, oldest first, from a storage listing
 * (`{ name, id, created_at, metadata }`). Folders (id null, e.g. `incoming`) and stray names are
 * left out.
 */
export function checkedPhotos(listing) {
  return (listing ?? [])
    .filter((item) => item && item.id && isMenuPhotoName(item.name))
    .map((item) => ({ name: item.name, uploadedAt: item.created_at ?? null, size: Number(item.metadata?.size) || 0 }))
    .sort((a, b) => String(a.uploadedAt).localeCompare(String(b.uploadedAt)) || a.name.localeCompare(b.name));
}

/** Restaurant folders at the bucket root (merchant ids). */
export function merchantFolders(listing) {
  return (listing ?? []).filter((item) => item && !item.id && typeof item.name === "string" && UUID.test(item.name)).map((item) => item.name);
}

/**
 * The bucket is missing (the migration has not run yet): the feature hides instead of failing.
 * From storage.getBucket(); note that list() on a missing bucket returns no error at all.
 */
export function isMissingBucketError(error) {
  const text = `${error?.message ?? ""} ${error?.error ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return text.includes("bucket not found") || text.includes("nosuchbucket");
}
