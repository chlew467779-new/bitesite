/**
 * D2-C Admin governance (publish / hide / suspend / lift suspension / archive / restore, and business
 * status), shared by the API route and
 * the Admin status panel. The database (public.merchant_governance_apply) decides and enforces
 * every rule; this module only parses requests, maps RPC errors and describes states.
 */

export const GOVERNANCE_ACTIONS = Object.freeze(["publish", "hide", "suspend", "unsuspend", "archive", "restore"]);
export const BUSINESS_STATUSES = Object.freeze([
  { value: "OPEN", label: "Open" },
  { value: "TEMPORARILY_CLOSED", label: "Temporarily closed" },
  { value: "MOVED", label: "Moved" },
  { value: "PERMANENTLY_CLOSED", label: "Permanently closed" },
]);
export const GOVERNANCE_REASON_MAX = 500;
export const MAX_GOVERNANCE_BODY_BYTES = 4 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Button label, confirmation title and what the action does, for the Admin panel. */
export const GOVERNANCE_ACTION_INFO = Object.freeze({
  publish: { label: "Publish", title: "Publish this restaurant?", effect: "The restaurant page becomes public and appears in listings.", reasonRequired: false, danger: false },
  hide: { label: "Hide", title: "Hide this restaurant?", effect: "The restaurant page stops being public. The Owner can still sign in and edit it. You can publish it again later.", reasonRequired: true, danger: true },
  suspend: { label: "Suspend", title: "Suspend this restaurant?", effect: "The restaurant page stops being public and the Owner can no longer change it. Admin can still correct its content. Lifting the suspension restores the earlier visibility.", reasonRequired: true, danger: true },
  unsuspend: { label: "Lift suspension", title: "Lift the suspension?", effect: "The Owner can edit again. The page returns to the visibility it had before (public if it was published, otherwise hidden).", reasonRequired: true, danger: false },
  archive: { label: "Archive", title: "Archive this restaurant?", effect: "For restaurants that are gone for good. The page stops being public and nobody can edit the restaurant, including Admin. You can restore it later; it comes back hidden.", reasonRequired: true, danger: true },
  restore: { label: "Restore", title: "Restore this restaurant?", effect: "Editing opens again. The page stays hidden until you publish it.", reasonRequired: true, danger: false },
});

/**
 * Parse `{ requestId, action, reason }`, or `{ requestId, action: "set_business_status",
 * businessStatus, reason }` (reason required unless the status is OPEN).
 */
export function parseGovernanceRequest(body) {
  const fail = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Invalid request.");
  const keys = Object.keys(body);
  if (keys.some((key) => !["requestId", "action", "reason", "businessStatus"].includes(key))) return fail("Unexpected fields in the request.");
  const { requestId, action, reason, businessStatus } = body;
  if (typeof requestId !== "string" || !UUID_PATTERN.test(requestId)) return fail("A valid requestId is required.");
  const business = action === "set_business_status";
  if (typeof action !== "string" || (!business && !GOVERNANCE_ACTIONS.includes(action))) return fail("Unknown action.");
  if (business !== (businessStatus !== undefined)) return fail("Unexpected fields in the request.");
  if (business && !BUSINESS_STATUSES.some((s) => s.value === businessStatus)) return fail("Unknown business status.");
  if (reason !== undefined && reason !== null && typeof reason !== "string") return fail("The reason must be text.");
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  const reasonRequired = business ? businessStatus !== "OPEN" : GOVERNANCE_ACTION_INFO[action].reasonRequired;
  if (reasonRequired && !trimmed) return fail("Please give a reason. It is kept in the change log.");
  if (trimmed.length > GOVERNANCE_REASON_MAX) return fail(`The reason can be at most ${GOVERNANCE_REASON_MAX} characters.`);
  if (business) return { ok: true, requestId, action, businessStatus, reason: trimmed || null };
  return { ok: true, requestId, action, reason: trimmed || null };
}

const FORBIDDEN_DETAIL = Object.freeze({
  archived: "This restaurant is archived. Restore it first.",
  suspended: "This restaurant is suspended. Lift the suspension before publishing it.",
  managed_visibility: "This restaurant's visibility is managed by its Owner's publication flow. Only suspend or lift a suspension here.",
  admin_only: "Only BiteSite Admin can do this.",
});

const RPC_ERRORS = Object.freeze({
  RESOURCE_NOT_FOUND: [404, "Restaurant not found."],
  OPERATION_FORBIDDEN: [409, "This action is not available for this restaurant right now."],
  PUBLIC_CONTACT_MINIMUM: [422, "A public restaurant needs at least one valid phone, WhatsApp or email contact. Add one in the Contact section first."],
  VALIDATION_FAILED: [400, "The request could not be accepted."],
  IDEMPOTENCY_KEY_REUSED: [409, "This action was already sent with different details. Please try again."],
  IDEMPOTENCY_KEY_EXPIRED: [409, "This request has expired. Please try again."],
});

/** Map a PostgREST/RPC error to `{ status, code, message }`; unknown errors become 500. */
export function mapGovernanceRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  if (error?.code === "P0001" && Object.hasOwn(RPC_ERRORS, code)) {
    const [status, message] = RPC_ERRORS[code];
    const detail = typeof error.details === "string" ? error.details : "";
    if (code === "OPERATION_FORBIDDEN" && Object.hasOwn(FORBIDDEN_DETAIL, detail)) return { status, code, message: FORBIDDEN_DETAIL[detail] };
    if (code === "VALIDATION_FAILED" && detail === "reason_required") return { status, code, message: "Please give a reason. It is kept in the change log." };
    return { status, code, message };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Nothing was changed; please try again." };
}

/** Turn the RPC result into `{ status, body }` for the response. */
export function governanceResponse(result, requestId) {
  if (result?.status === "applied" || result?.status === "noop") {
    return {
      status: 200,
      body: {
        data: { status: result.status, action: result.action ?? "set_business_status", businessStatus: result.businessStatus ?? null, state: result.state ?? null, updatedAt: result.updatedAt ?? null },
        revision: result.revision ?? null,
        requestId,
        replayed: result.replayed === true,
      },
    };
  }
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected result." }, requestId } };
}

/** One short label for the current state, e.g. "Public", "Hidden", "Suspended". */
export function describeGovernanceState(state) {
  if (!state) return "Unknown";
  if (state.restriction === "archived") return "Archived";
  if (state.restriction === "suspended") return "Suspended";
  if (state.public) return "Public";
  if (state.stateSource === "legacy" && state.platformStatus === "PENDING_REVIEW") return "Hidden (waiting for review)";
  if (state.stateSource === "managed" && state.reviewStatus !== "approved") return `Hidden (review: ${state.reviewStatus})`;
  return "Hidden";
}
