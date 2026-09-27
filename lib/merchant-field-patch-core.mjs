/* bitesite/lib/merchant-field-patch-core.mjs */

/**
 * D2-A field-level save contract, HTTP side (master spec §8; D2A_IMPLEMENTATION_DIRECTION).
 *
 * A save request is `{ requestId, patches: [{ path, expected, value }] }`:
 * - `path` is a logical path from MERCHANT_FIELD_REGISTRY, never a column, table or JSONPath;
 * - `expected` is the snapshot the client last saw: `{ exists: true, value }` or `{ exists: false }`;
 * - `value` is the desired value (null clears a text field or removes an opening-hours day).
 * The database (public.merchant_field_patch) re-checks the same registry, authorizes the actor,
 * compares every expected value under a row lock and writes all or nothing. This module only
 * rejects malformed requests early and turns RPC results/errors into HTTP responses.
 *
 * Pure ESM, no I/O: scripts/test-merchant-field-patch.mjs tests it and checks that the registry
 * matches the migration. merchant-field-patch-core.d.mts carries the types.
 */
import { PROFILE_TEXT_FIELDS, validateProfileField } from "./merchant-profile-validation.mjs";
import { isPersistableLayout } from "./layout-registry.mjs";
import { isEditorHoursValue } from "./merchant-hours.mjs";

const entry = (path, kind, target, owner, admin, maxLength) => Object.freeze({ path, kind, target, owner, admin, maxLength });

/** Same rows, in the same order, as private.merchant_field_registry(). */
export const MERCHANT_FIELD_REGISTRY = Object.freeze([
  entry("profile.tagline", "text", "tagline", true, true, 300),
  entry("profile.description", "text", "description", true, true, 10000),
  entry("profile.phone", "text", "phone", true, true, 40),
  entry("profile.whatsapp", "text", "whatsapp", true, true, 40),
  entry("profile.email", "text", "email", true, true, 254),
  entry("profile.website", "text", "website", false, false, null),
  entry("profile.instagram", "text", "instagram", false, false, null),
  entry("profile.facebook", "text", "facebook", false, false, null),
  entry("profile.menu_pdf_url", "text", "menu_pdf_url", false, false, null),
  entry("hours.mon", "hours", "monday", true, true, 100),
  entry("hours.tue", "hours", "tuesday", true, true, 100),
  entry("hours.wed", "hours", "wednesday", true, true, 100),
  entry("hours.thu", "hours", "thursday", true, true, 100),
  entry("hours.fri", "hours", "friday", true, true, 100),
  entry("hours.sat", "hours", "saturday", true, true, 100),
  entry("hours.sun", "hours", "sunday", true, true, 100),
  entry("features.hero", "feature", "hero", false, true, null),
  entry("features.about", "feature", "about", false, true, null),
  entry("features.contact", "feature", "contact", false, true, null),
  entry("features.gallery", "feature", "gallery", false, true, null),
  entry("features.events", "feature", "events", false, true, null),
  entry("features.appointment", "feature", "appointment", false, true, null),
  entry("features.seasonal_popup", "feature", "seasonal_popup", false, true, null),
  entry("features.menu", "feature", "menu", false, false, null),
  entry("features.reviews", "feature", "reviews", false, false, null),
  // B0 (migration 20260927034414): Admin-only. For tag_array, maxLength is the maximum tag count.
  entry("profile.name", "text", "name", false, true, 160),
  entry("presentation.layout", "layout", "layout", false, true, 32),
  entry("tags.cuisine", "tag_array", "cuisine", false, true, 3),
  entry("tags.amenities", "tag_array", "amenities", false, true, 5),
  entry("tags.occasion", "tag_array", "occasion", false, true, 3),
  entry("location", "location", "location", false, true, null),
]);

const BY_PATH = new Map(MERCHANT_FIELD_REGISTRY.map((row) => [row.path, row]));
const LINK_PATHS = new Set(["profile.website", "profile.instagram", "profile.facebook", "profile.menu_pdf_url"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PATCHES = 50;
export const MAX_FIELD_PATCH_BODY_BYTES = 64 * 1024;

const fail = (status, code, message, fieldErrors) => ({ ok: false, status, code, message, ...(fieldErrors ? { fieldErrors } : {}) });
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const ownKeys = (value) => Object.keys(value).sort().join(",");

export function isWritablePath(path, actorType) {
  const row = BY_PATH.get(path);
  return Boolean(row && (actorType === "owner" ? row.owner : actorType === "admin" ? row.admin : false));
}

export function notWritableMessage(path) {
  if (LINK_PATHS.has(path)) return "Links are checked by the BiteSite team before they go live. Link changes are not open yet.";
  if (path.startsWith("features.")) return "This section setting cannot be changed here.";
  return "This field cannot be changed here.";
}

function validSnapshot(snapshot) {
  if (!isPlainObject(snapshot) || typeof snapshot.exists !== "boolean") return false;
  return snapshot.exists ? ownKeys(snapshot) === "exists,value" : ownKeys(snapshot) === "exists";
}

/**
 * Validate a save request for one actor. Returns `{ ok: true, requestId, patches }` with text and
 * hours values trimmed, or `{ ok: false, status, code, message, fieldErrors? }`.
 */
export function parseFieldPatchRequest(body, actorType) {
  if (!isPlainObject(body)) return fail(400, "INVALID_JSON", "The request body must be a JSON object.");
  const unknown = Object.keys(body).filter((key) => key !== "requestId" && key !== "patches");
  if (unknown.length > 0) return fail(400, "UNKNOWN_FIELD", `Unknown request field: ${unknown[0]}`);
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return fail(400, "VALIDATION_FAILED", "requestId must be a UUID.");
  if (!Array.isArray(body.patches) || body.patches.length === 0 || body.patches.length > MAX_PATCHES) {
    return fail(400, "VALIDATION_FAILED", `patches must list 1 to ${MAX_PATCHES} changes.`);
  }

  const seen = new Set();
  const patches = [];
  const fieldErrors = {};
  for (const patch of body.patches) {
    if (!isPlainObject(patch) || ownKeys(patch) !== "expected,path,value" || typeof patch.path !== "string") {
      return fail(400, "VALIDATION_FAILED", "Each change needs exactly path, expected and value.");
    }
    const row = BY_PATH.get(patch.path);
    if (!row) return fail(400, "UNKNOWN_FIELD", `Unknown field: ${patch.path}`);
    if (seen.has(row.path)) return fail(400, "VALIDATION_FAILED", `${row.path} is listed twice.`);
    seen.add(row.path);
    if (!isWritablePath(row.path, actorType)) return fail(400, "FIELD_NOT_WRITABLE", notWritableMessage(row.path), { [row.path]: notWritableMessage(row.path) });
    if (!validSnapshot(patch.expected)) return fail(400, "VALIDATION_FAILED", `${row.path}: expected must be { exists, value } or { exists: false }.`);

    let value = patch.value;
    if (row.kind === "feature") {
      if (typeof value !== "boolean") return fail(400, "VALIDATION_FAILED", `${row.path} must be true or false.`);
    } else if (row.kind === "layout") {
      if (!isPersistableLayout(value)) fieldErrors[row.path] = "Choose one of the available layouts.";
    } else if (row.kind === "tag_array") {
      if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string" || !tag.trim())) return fail(400, "VALIDATION_FAILED", `${row.path} must be a list of tags.`);
      value = value.map((tag) => tag.trim());
      if (new Set(value).size !== value.length) fieldErrors[row.path] = "Each tag can be chosen once.";
      else if (value.length > row.maxLength) fieldErrors[row.path] = `Choose up to ${row.maxLength}.`;
    } else if (row.kind === "location") {
      const location = parseLocation(value);
      if (typeof location === "string") fieldErrors[row.path] = location;
      else value = location;
    } else if (row.path === "profile.name" && value === null) {
      fieldErrors[row.path] = "A restaurant needs a name.";
    } else if (value !== null) {
      if (typeof value !== "string") return fail(400, "VALIDATION_FAILED", `${row.path} must be text or null.`);
      value = value.trim();
      if (!value) return fail(400, "VALIDATION_FAILED", `${row.path}: send null to clear a value.`);
      if (value.length > row.maxLength) fieldErrors[row.path] = `Use ${row.maxLength} characters or fewer.`;
      else if (row.kind === "text" && PROFILE_TEXT_FIELDS.includes(row.target)) {
        const message = validateProfileField(row.target, value);
        if (message) fieldErrors[row.path] = message;
      } else if (row.kind === "hours" && !isEditorHoursValue(value)) {
        fieldErrors[row.path] = "Choose Open with times from the picker, or Closed.";
      }
    }
    patches.push({ path: row.path, expected: patch.expected, value });
  }
  if (Object.keys(fieldErrors).length > 0) return fail(400, "VALIDATION_FAILED", "Please fix the highlighted fields.", fieldErrors);
  return { ok: true, requestId: body.requestId.toLowerCase(), patches };
}

/** The location group: exactly address, area, latitude, longitude. Returns the cleaned group or a message. */
export function parseLocation(value) {
  if (!isPlainObject(value) || ownKeys(value) !== "address,area,latitude,longitude") return "Location needs address, area, latitude and longitude.";
  const text = (raw, max, label) => {
    if (raw === null) return null;
    if (typeof raw !== "string" || !raw.trim()) return { error: `${label} must be text, or empty.` };
    return raw.trim().length > max ? { error: `${label}: use ${max} characters or fewer.` } : raw.trim();
  };
  const address = text(value.address, 500, "Address");
  if (address && typeof address === "object") return address.error;
  const area = text(value.area, 160, "Area");
  if (area && typeof area === "object") return area.error;
  const { latitude, longitude } = value;
  if ((latitude === null) !== (longitude === null)) return "Enter both latitude and longitude, or clear both.";
  if (latitude !== null) {
    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Latitude and longitude must be numbers.";
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "Latitude must be between -90 and 90, longitude between -180 and 180.";
  }
  return { address, area, latitude, longitude };
}

const RPC_ERRORS = Object.freeze({
  RESOURCE_NOT_FOUND: [404, "Restaurant not found."],
  MERCHANT_SUSPENDED: [403, "This restaurant is suspended, so it cannot be changed. Contact BiteSite through Feedback."],
  OPERATION_FORBIDDEN: [403, "This restaurant cannot be changed right now."],
  VALIDATION_FAILED: [400, "The change could not be accepted."],
  UNKNOWN_FIELD: [400, "Unknown field."],
  FIELD_NOT_WRITABLE: [400, "This field cannot be changed here."],
  PUBLIC_CONTACT_MINIMUM: [422, "A public restaurant needs at least one phone, WhatsApp or email contact."],
  IDEMPOTENCY_KEY_REUSED: [409, "This save was already sent with different changes. Please try saving again."],
  IDEMPOTENCY_KEY_EXPIRED: [409, "This save request has expired. Please try saving again."],
});

/** Map a PostgREST/RPC error to `{ status, code, message }`; unknown errors become 500. */
export function mapFieldRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  if (error?.code === "P0001" && Object.hasOwn(RPC_ERRORS, code)) {
    const [status, message] = RPC_ERRORS[code];
    const detail = typeof error.details === "string" ? error.details : "";
    if (code === "FIELD_NOT_WRITABLE" && BY_PATH.has(detail)) return { status, code, message: notWritableMessage(detail) };
    if (code === "OPERATION_FORBIDDEN" && detail === "pending_review") return { status, code, message: "This restaurant is waiting for review, so it cannot be changed until the review ends or you withdraw it." };
    return { status, code, message };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Your changes are still here; please try again." };
}

/** Turn the RPC result into `{ status, body }` for the response. */
export function fieldPatchResponse(result, requestId) {
  const replayed = result?.replayed === true;
  if (result?.status === "conflict") {
    return {
      status: 409,
      body: {
        error: { code: "FIELD_CONFLICT", message: "This field changed in another session.", conflicts: result.conflicts ?? [] },
        revision: result.revision ?? null,
        requestId,
        replayed,
      },
    };
  }
  if (result?.status === "applied" || result?.status === "noop") {
    return {
      status: 200,
      body: {
        data: { status: result.status, values: result.values ?? {}, changedPaths: result.changedPaths ?? [], updatedAt: result.updatedAt ?? null },
        revision: result.revision ?? null,
        requestId,
        replayed,
      },
    };
  }
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected save result." }, requestId } };
}
