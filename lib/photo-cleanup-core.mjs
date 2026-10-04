/**
 * Photo cleanup (C6): which uploaded photos nothing uses any more. Pure; the Admin route
 * (app/api/admin/photo-cleanup) lists the storage objects and reads the referencing columns.
 *
 * Safety rules:
 *  - Only the public photo buckets (merchant-media, story-media). Private menu photos are already
 *    deleted after use and are never touched here.
 *  - A file is "in use" when its object path appears ANYWHERE in the text of the referencing
 *    columns below (current pages, menus, Stories, Story submissions, events, pop-ups, pending
 *    change requests and review snapshots). Paths contain random ids, so a match is never a guess.
 *  - Only files older than MIN_AGE_DAYS, so an upload in progress is never removed.
 *  - If any referencing table cannot be read, nothing may be deleted (the route refuses).
 */

export const CLEANUP_BUCKETS = Object.freeze(["merchant-media", "story-media"]);
export const MIN_AGE_DAYS = 30;
export const MAX_DELETE_PER_RUN = 500;

/** Every column that can hold a photo URL. Audit history (change log, article revisions) is left out on purpose. */
export const REFERENCE_SOURCES = Object.freeze([
  { table: "merchants", columns: ["logo_image", "cover_image", "features", "settings", "reviews", "description", "video_url"] },
  { table: "products", columns: ["image_url", "description"] },
  { table: "articles", columns: ["cover_image", "content", "generated_copy"] },
  { table: "story_submissions", columns: ["cover_image", "content", "image_urls", "facts", "generated_copy"] },
  { table: "events", columns: ["image_url"] },
  { table: "site_announcements", columns: ["image_url"] },
  { table: "merchant_videos", columns: ["video_url"] },
  { table: "merchant_profile_change_requests", columns: ["changes"] },
  { table: "merchant_basics_requests", columns: ["base", "changes"] },
  { table: "merchant_review_submissions", columns: ["snapshot"] },
]);

const PLACEHOLDER = ".emptyFolderPlaceholder";

/**
 * @param {{ bucket: string, path: string, size: number, createdAt: string }[]} objects
 * @param {string} referenceText all referencing column values joined (JSON.stringify of the rows is fine)
 * @param {number} now ms
 * @returns {{ bucket: string, path: string, size: number, createdAt: string }[]} unused objects, oldest first
 */
export function findUnusedPhotos(objects, referenceText, now = Date.now(), minAgeDays = MIN_AGE_DAYS) {
  const cutoff = now - minAgeDays * 86_400_000;
  // JSON text escapes "/" only optionally; normalise so either form matches.
  const text = String(referenceText).replace(/\\\//g, "/");
  return objects
    .filter((o) => CLEANUP_BUCKETS.includes(o.bucket) && typeof o.path === "string" && o.path && !o.path.endsWith(PLACEHOLDER))
    .filter((o) => { const t = Date.parse(o.createdAt); return Number.isFinite(t) && t < cutoff; })
    .filter((o) => !text.includes(o.path) && !text.includes(encodeURI(o.path)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Admin delete body: `{ items: [{ bucket, path }] }` (at most MAX_DELETE_PER_RUN). */
export function parseCleanupDelete(body) {
  const invalid = (message = "Invalid request.") => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((k) => k !== "items")) return invalid();
  if (!Array.isArray(body.items) || body.items.length === 0) return invalid("Nothing to delete.");
  if (body.items.length > MAX_DELETE_PER_RUN) return invalid(`At most ${MAX_DELETE_PER_RUN} photos at a time.`);
  const items = [];
  const seen = new Set();
  for (const item of body.items) {
    if (!item || typeof item !== "object" || Object.keys(item).some((k) => k !== "bucket" && k !== "path")) return invalid();
    if (!CLEANUP_BUCKETS.includes(item.bucket)) return invalid();
    if (typeof item.path !== "string" || item.path.length > 500 || !/^[A-Za-z0-9._/-]+$/.test(item.path) || item.path.includes("..") || item.path.startsWith("/")) return invalid();
    const key = `${item.bucket}/${item.path}`;
    if (!seen.has(key)) { seen.add(key); items.push({ bucket: item.bucket, path: item.path }); }
  }
  return { ok: true, items };
}
