/*
 * Site errors (SYNC-070): turn a server log line or a browser crash into a short, redacted message
 * and a grouping key, so Admin sees one row per kind of error instead of one per visitor.
 * Pure, shared by app/api/_lib/site-errors.ts, /api/site-errors, /api/admin/site-errors and
 * scripts/test-site-errors.mjs.
 */

export const SITE_ERROR_STATUSES = Object.freeze(["new", "resolved"]);
export const SITE_ERROR_MESSAGE_LIMIT = 500;
export const MAX_BROWSER_ERROR_BODY_BYTES = 4 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Short, single-line text with personal data and secrets removed: email addresses, phone-like and
 * other long numbers, long tokens/keys, and the query part of URLs. Empty when nothing is left.
 */
export function redactErrorText(text) {
  if (typeof text !== "string") return "";
  const cleaned = text
    .replace(/[⨯×]/g, " ") // Next's "⨯" log prefix
    .replace(/\s+/g, " ")
    .replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/gi, "$1")
    .replace(/[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_[a-z]+_[\w-]+|[A-Za-z0-9_-]{32,})\b/g, "[secret]")
    // Phone-like: nine or more digits (dates such as 2026-10-03 have eight and stay readable).
    .replace(/\+?\d[\d\s-]{6,}\d/g, (run) => (run.replace(/\D/g, "").length >= 9 ? "[number]" : run))
    .trim();
  return cleaned.length > SITE_ERROR_MESSAGE_LIMIT ? `${cleaned.slice(0, SITE_ERROR_MESSAGE_LIMIT - 1)}…` : cleaned;
}

/**
 * Grouping key text: the same kind of error with a different id, number or quoted value groups
 * together. The server hashes this (sha256) into the stored fingerprint.
 */
export function fingerprintText(source, message) {
  const shape = String(message)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .replace(/"[^"]{0,80}"|'[^']{0,80}'/g, "<q>")
    .slice(0, 200)
    .toLowerCase();
  return `${source}:${shape}`;
}

/** The page part of a request path: no query or fragment, on this site only; null otherwise. */
export function pagePathOnly(path) {
  if (typeof path !== "string") return null;
  const page = path.split(/[?#]/, 1)[0];
  if (!page.startsWith("/") || page.startsWith("//") || /\s/.test(page)) return null;
  return page.length > 300 ? page.slice(0, 300) : page;
}

function describe(value) {
  if (value instanceof Error) return value.name && value.name !== "Error" ? `${value.name}: ${value.message}` : value.message;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isObject(value) && typeof value.message === "string") return value.message;
  return "";
}

/** Next.js control-flow signals (notFound, redirect) and stale-tab chunk loads are not site errors. */
export function isIgnoredError(message, digest) {
  if (typeof digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest)) return true;
  if (typeof digest === "string" && digest === "DYNAMIC_SERVER_USAGE") return true;
  return /\b(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)\b|ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/.test(String(message));
}

/** One message from console.error arguments (strings, Errors, `{ message }` objects); "" if none. */
export function messageFromConsoleArgs(args) {
  if (!Array.isArray(args)) return "";
  const text = args.map(describe).filter(Boolean).join(" ");
  const digest = args.find((a) => isObject(a) || a instanceof Error)?.digest;
  if (!text || isIgnoredError(text, digest)) return "";
  return redactErrorText(text);
}

/**
 * Browser crash report `{ message, page, digest? }`. A crash with a digest came from the server,
 * which recorded it already, so it is skipped (`skip: true`).
 */
export function parseBrowserErrorReport(body) {
  if (!isObject(body) || Object.keys(body).some((k) => !["message", "page", "digest"].includes(k))) return invalid("Invalid request.");
  if (typeof body.message !== "string" || body.message.length > 2000) return invalid("Invalid request.");
  if (body.digest !== undefined && body.digest !== null && typeof body.digest !== "string") return invalid("Invalid request.");
  const message = redactErrorText(body.message);
  if (!message) return invalid("Invalid request.");
  const skip = Boolean(body.digest) || isIgnoredError(message, body.digest);
  return { ok: true, skip, message, page: pagePathOnly(body.page) };
}

/** Admin: `{ ids: uuid[1..100], status: 'new'|'resolved' }` marks one or many at once. */
export function parseSiteErrorUpdate(body) {
  if (!isObject(body) || Object.keys(body).some((k) => !["ids", "status"].includes(k))) return invalid("Invalid request.");
  if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 100 || body.ids.some((id) => typeof id !== "string" || !UUID.test(id))) return invalid("Choose 1 to 100 items.");
  if (!SITE_ERROR_STATUSES.includes(body.status)) return invalid("Unknown status.");
  return { ok: true, ids: [...new Set(body.ids)], status: body.status };
}
