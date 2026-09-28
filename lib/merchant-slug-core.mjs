/**
 * Restaurant web address (slug) changes, shared by the Admin route and panel. Mirrors
 * private.merchant_slug_valid; the database decides (it also refuses addresses another restaurant
 * used before, which keep redirecting to that restaurant).
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const MAX_SLUG_BODY_BYTES = 2 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });

export function normalizeSlug(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidSlug(value) {
  return typeof value === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length >= 2 && value.length <= 64;
}

export const SLUG_RULE_TEXT = "Use 2–64 lowercase letters, numbers and single hyphens (for example kedai-kopi-ah-seng).";

/** `{ requestId, slug, expected }` */
export function parseSlugChange(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Invalid request.");
  if (Object.keys(body).some((k) => !["requestId", "slug", "expected"].includes(k))) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (typeof body.expected !== "string" || body.expected.length > 300) return invalid("Invalid request.");
  const slug = normalizeSlug(body.slug);
  if (!isValidSlug(slug)) return invalid(SLUG_RULE_TEXT);
  return { ok: true, requestId: body.requestId, slug, expected: body.expected };
}

export function mapSlugRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (code === "SLUG_TAKEN") return { status: 409, code, message: "This web address is used by another restaurant, now or before. Choose another." };
  if (error?.code === "P0001" && code === "VALIDATION_FAILED" && detail === "slug_format") return { status: 400, code, message: SLUG_RULE_TEXT };
  return mapFieldRpcError(error);
}
