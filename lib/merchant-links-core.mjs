/**
 * Link review (website, Instagram, Facebook, menu PDF, GrabFood), shared by the Owner/Admin routes
 * and the link controls. linkProblem mirrors private.merchant_link_problem; the database decides.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const LINK_FIELDS = Object.freeze([
  { field: "website", label: "Website", placeholder: "https://yourrestaurant.com" },
  { field: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourrestaurant" },
  { field: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourrestaurant" },
  { field: "menu_pdf_url", label: "Menu link (PDF)", placeholder: "https://…/menu.pdf" },
  { field: "grabfood", label: "GrabFood", placeholder: "https://food.grab.com/…" },
]);
const FIELD_NAMES = LINK_FIELDS.map((f) => f.field);
export const MAX_LINK_BODY_BYTES = 4 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });

export const LINK_PROBLEM_TEXT = Object.freeze({
  too_long: "The link is too long (500 characters at most).",
  https_only: "The link must start with https://",
  credentials: "Links with a user name or password are not allowed.",
  host: "Use a normal web address (not an IP address).",
  host_instagram: "Use an instagram.com link.",
  host_facebook: "Use a facebook.com link.",
  host_grabfood: "Use a GrabFood link (grab.com).",
});

/** Null when acceptable, else a key of LINK_PROBLEM_TEXT. Empty = remove the link (acceptable). */
export function linkProblem(field, url) {
  const value = typeof url === "string" ? url.trim() : "";
  if (!value) return null;
  if (value.length > 500) return "too_long";
  if (!/^https:\/\/\S+$/.test(value)) return "https_only";
  let host = (value.match(/^https:\/\/([^/?#]*)/)?.[1] ?? "").toLowerCase();
  if (host.includes("@")) return "credentials";
  host = host.replace(/:[0-9]+$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host) || /^[0-9.]+$/.test(host) || host === "localhost" || host.endsWith(".localhost")) return "host";
  if (field === "instagram" && !["instagram.com", "www.instagram.com"].includes(host)) return "host_instagram";
  if (field === "facebook" && !["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com"].includes(host)) return "host_facebook";
  if (field === "grabfood" && host !== "grab.com" && !host.endsWith(".grab.com")) return "host_grabfood";
  return null;
}

const urlOrNull = (value) => value === null || (typeof value === "string" && value.length <= 600);

/** Owner: `{ requestId, action: 'request', field, url }` or `{ requestId, action: 'withdraw', linkRequestId }`. */
export function parseOwnerLinkRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (body.action === "request") {
    if (Object.keys(body).some((k) => !["requestId", "action", "field", "url"].includes(k))) return invalid("Invalid request.");
    if (!FIELD_NAMES.includes(body.field)) return invalid("Unknown link.");
    if (!urlOrNull(body.url)) return invalid("Invalid link.");
    const problem = linkProblem(body.field, body.url);
    if (problem) return { ok: false, status: 400, code: "INVALID_LINK", message: LINK_PROBLEM_TEXT[problem] };
    return { ok: true, action: "request", requestId: body.requestId, field: body.field, url: body.url?.trim() || null };
  }
  if (body.action === "withdraw") {
    if (Object.keys(body).some((k) => !["requestId", "action", "linkRequestId"].includes(k))) return invalid("Invalid request.");
    if (typeof body.linkRequestId !== "string" || !UUID_PATTERN.test(body.linkRequestId)) return invalid("Invalid request.");
    return { ok: true, action: "withdraw", requestId: body.requestId, linkRequestId: body.linkRequestId };
  }
  return invalid("Unknown action.");
}

/** Admin direct edit: `{ requestId, field, url, expected }`. */
export function parseAdminLinkSet(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Invalid request.");
  if (Object.keys(body).some((k) => !["requestId", "field", "url", "expected"].includes(k))) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (!FIELD_NAMES.includes(body.field)) return invalid("Unknown link.");
  if (!urlOrNull(body.url) || !urlOrNull(body.expected)) return invalid("Invalid link.");
  const problem = linkProblem(body.field, body.url);
  if (problem) return { ok: false, status: 400, code: "INVALID_LINK", message: LINK_PROBLEM_TEXT[problem] };
  return { ok: true, requestId: body.requestId, field: body.field, url: body.url?.trim() || null, expected: body.expected };
}

/** Admin review: `{ requestId, linkRequestId, decision: 'approve'|'reject', note }`. */
export function parseLinkReview(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Invalid request.");
  if (Object.keys(body).some((k) => !["requestId", "linkRequestId", "decision", "note"].includes(k))) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (typeof body.linkRequestId !== "string" || !UUID_PATTERN.test(body.linkRequestId)) return invalid("Invalid request.");
  if (body.decision !== "approve" && body.decision !== "reject") return invalid("Unknown decision.");
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") return invalid("The note must be text.");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.decision === "reject" && !note) return invalid("Please say why the link is rejected. The restaurant sees this note.");
  if (note.length > 500) return invalid("The note can be at most 500 characters.");
  return { ok: true, requestId: body.requestId, linkRequestId: body.linkRequestId, decision: body.decision, note: note || null };
}

export function mapLinkRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001" && code === "INVALID_LINK") return { status: 400, code, message: LINK_PROBLEM_TEXT[detail] ?? "This link cannot be used." };
  if (error?.code === "P0001" && code === "LINK_CHANGED_SINCE_REQUEST") return { status: 409, code, message: "This link was changed after the restaurant asked. Reject the request with a note, or ask them to send it again." };
  if (error?.code === "P0001" && code === "VALIDATION_FAILED" && detail === "not_pending") return { status: 409, code, message: "This request was already decided or withdrawn." };
  if (error?.code === "P0001" && code === "RESOURCE_NOT_FOUND" && detail === "link_request") return { status: 409, code, message: "This request no longer exists or was already decided." };
  return mapFieldRpcError(error);
}
