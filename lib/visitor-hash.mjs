/*
 * Server-side helpers for /api/track (#31 visitor privacy). Tested by scripts/test-admin-performance.mjs.
 */

import { createHmac } from "node:crypto";

/**
 * Keyed hash of a visitor IP: the only form page_views may hold (#31). 32 hex characters, or null
 * without a secret or a usable address, so a raw IP is never stored.
 */
export function visitorHash(ip, secret) {
  if (!secret || !ip || ip === "unknown") return null;
  return createHmac("sha256", secret).update(`visitor:${ip}`).digest("hex").slice(0, 32);
}

/** Result count sent with a search event: a whole number 0..10000, anything else → null. */
export function parseResultCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 10000 ? value : null;
}
