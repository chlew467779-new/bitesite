/* bitesite/lib/merchant-access-core.mjs */

/**
 * Which merchant a signed-in user may act on, decided from that user's own active Owner
 * memberships (master spec §4.3). Pure ESM with no I/O so scripts/test-merchant-access.mjs can
 * test every outcome; lib/merchant-access.ts loads the memberships and turns the outcome into a
 * response. merchant-access-core.d.mts carries the types.
 *
 * - The merchant always comes from the caller's memberships, never from a client-supplied ID
 *   alone: a requested ID only selects one of them.
 * - A missing, malformed or foreign merchant ID is 404, so other merchants cannot be enumerated.
 * - Without an ID, exactly one membership is used (compatibility for single-restaurant owners);
 *   several memberships require an explicit ID (409 MERCHANT_CONTEXT_REQUIRED).
 * - Suspended or archived merchants stay readable by their Owner but refuse writes (403).
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The merchant columns the access decision and the merchant list need. */
export const MERCHANT_ACCESS_COLUMNS = Object.freeze([
  "id",
  "name",
  "slug",
  "business_status",
  "platform_status",
  "platform_restriction",
]);

/**
 * Platform restriction of a merchant. Managed rows carry it in platform_restriction; legacy rows
 * still use platform_status (the same rule as private.merchant_is_public).
 */
export function merchantRestriction(merchant) {
  if (merchant?.platform_restriction === "suspended" || merchant?.platform_status === "SUSPENDED") return "suspended";
  if (merchant?.platform_restriction === "archived" || merchant?.platform_status === "ARCHIVED") return "archived";
  return "none";
}

/** The safe summary of one merchant shown to its Owner. */
export function merchantSummary(merchant) {
  return {
    id: merchant.id,
    name: merchant.name,
    slug: merchant.slug,
    business_status: merchant.business_status ?? null,
    restriction: merchantRestriction(merchant),
  };
}

/**
 * The requested merchant ID from a query value: undefined when absent or empty, otherwise the
 * trimmed string (validated later, so a malformed value is a 404 rather than "absent").
 */
export function readRequestedMerchantId(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const denied = (status, code, message) => ({ ok: false, status, code, message });

const NOT_FOUND = () => denied(404, "RESOURCE_NOT_FOUND", "Restaurant not found.");

/**
 * Decide access.
 * @param {object} input
 * @param {Array<object>} input.merchants  merchants of the caller's active Owner memberships
 * @param {string | undefined} input.requestedMerchantId
 * @param {"read" | "write"} input.capability
 */
export function resolveMerchantAccess({ merchants, requestedMerchantId, capability }) {
  const own = Array.isArray(merchants) ? merchants.filter((merchant) => merchant && typeof merchant.id === "string") : [];

  let merchant;
  if (requestedMerchantId !== undefined) {
    if (typeof requestedMerchantId !== "string" || !UUID_PATTERN.test(requestedMerchantId)) return NOT_FOUND();
    const wanted = requestedMerchantId.toLowerCase();
    merchant = own.find((candidate) => candidate.id.toLowerCase() === wanted);
    if (!merchant) return NOT_FOUND();
  } else if (own.length === 1) {
    merchant = own[0];
  } else if (own.length === 0) {
    return NOT_FOUND();
  } else {
    return denied(409, "MERCHANT_CONTEXT_REQUIRED", "Choose which restaurant this is for.");
  }

  const restriction = merchantRestriction(merchant);
  if (capability === "write" && restriction === "suspended") {
    return denied(403, "MERCHANT_SUSPENDED", "This restaurant is suspended, so it cannot be changed. Contact BiteSite through Feedback.");
  }
  if (capability === "write" && restriction === "archived") {
    return denied(403, "OPERATION_FORBIDDEN", "This restaurant is archived and cannot be changed.");
  }
  return { ok: true, merchant, restriction };
}
