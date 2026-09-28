/**
 * Listing basics change requests (name, address/area, cuisine) after approval, shared by the
 * Owner/Admin routes and the request controls. The database validates again and decides.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const MAX_BASICS_BODY_BYTES = 8 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message = "Invalid request.") => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (v, allowed) => isObject(v) && Object.keys(v).every((k) => allowed.includes(k));
const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Owner form values -> the RPC `changes` object, with only the fields that differ from `current`.
 * Returns `{ ok: true, changes }` (possibly empty) or `{ ok: false, message }`.
 */
export function basicsChanges(current, draft) {
  const changes = {};
  const name = text(draft.name);
  if (!name) return { ok: false, message: "Enter the restaurant name." };
  if (name.length > 160) return { ok: false, message: "The name can be at most 160 characters." };
  if (name !== current.name) changes["profile.name"] = name;
  const address = text(draft.address);
  const area = text(draft.area) || null;
  if (!address) return { ok: false, message: "Enter the address." };
  if (address.length > 500) return { ok: false, message: "The address can be at most 500 characters." };
  if (area && area.length > 160) return { ok: false, message: "The area can be at most 160 characters." };
  if (address !== current.address || area !== (current.area ?? null)) changes.location = { address, area };
  const cuisine = [...new Set((draft.cuisine ?? []).map(text).filter(Boolean))];
  if (cuisine.length < 1 || cuisine.length > 3) return { ok: false, message: "Choose 1 to 3 cuisines." };
  if (cuisine.join("\n") !== (current.cuisine ?? []).join("\n")) changes["tags.cuisine"] = cuisine;
  return { ok: true, changes };
}

function validChanges(changes) {
  if (!isObject(changes) || Object.keys(changes).length === 0) return false;
  for (const [key, value] of Object.entries(changes)) {
    if (key === "profile.name") {
      if (typeof value !== "string" || !value.trim() || value.length > 200) return false;
    } else if (key === "location") {
      if (!onlyKeys(value, ["address", "area"]) || typeof value.address !== "string" || !value.address.trim() || value.address.length > 600) return false;
      if (value.area !== undefined && value.area !== null && (typeof value.area !== "string" || value.area.length > 200)) return false;
    } else if (key === "tags.cuisine") {
      if (!Array.isArray(value) || value.length < 1 || value.length > 3 || value.some((t) => typeof t !== "string" || !t.trim() || t.length > 64)) return false;
    } else {
      return false;
    }
  }
  return true;
}

/** Owner: `{ requestId, action: 'request', changes }` or `{ requestId, action: 'withdraw', basicsRequestId }`. */
export function parseOwnerBasicsRequest(body) {
  if (!isObject(body) || typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (body.action === "request") {
    if (!onlyKeys(body, ["requestId", "action", "changes"])) return invalid();
    if (!validChanges(body.changes)) return invalid("Check the name, address and cuisine.");
    return { ok: true, action: "request", requestId: body.requestId, changes: body.changes };
  }
  if (body.action === "withdraw") {
    if (!onlyKeys(body, ["requestId", "action", "basicsRequestId"])) return invalid();
    if (typeof body.basicsRequestId !== "string" || !UUID_PATTERN.test(body.basicsRequestId)) return invalid();
    return { ok: true, action: "withdraw", requestId: body.requestId, basicsRequestId: body.basicsRequestId };
  }
  return invalid("Unknown action.");
}

/** Admin review: `{ requestId, basicsRequestId, decision: 'approve'|'reject', note }`. */
export function parseBasicsReview(body) {
  if (!onlyKeys(body, ["requestId", "basicsRequestId", "decision", "note"])) return invalid();
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (typeof body.basicsRequestId !== "string" || !UUID_PATTERN.test(body.basicsRequestId)) return invalid();
  if (body.decision !== "approve" && body.decision !== "reject") return invalid("Unknown decision.");
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") return invalid("The note must be text.");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.decision === "reject" && !note) return invalid("Please say why the change is rejected. The restaurant sees this note.");
  if (note.length > 500) return invalid("The note can be at most 500 characters.");
  return { ok: true, requestId: body.requestId, basicsRequestId: body.basicsRequestId, decision: body.decision, note: note || null };
}

export function mapBasicsRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001") {
    if (code === "BASICS_CHANGED_SINCE_REQUEST") return { status: 409, code, message: "These details were changed after the restaurant asked. Reject the request with a note, or ask them to send it again." };
    if (code === "FIELD_NOT_WRITABLE" && detail === "basics_edit_directly") return { status: 409, code, message: "You can edit these details directly while your restaurant is a draft. Refresh the page." };
    if (code === "VALIDATION_FAILED" && detail === "not_pending") return { status: 409, code, message: "This request was already decided or withdrawn." };
    if (code === "RESOURCE_NOT_FOUND" && detail === "basics_request") return { status: 409, code, message: "This request no longer exists or was already decided." };
    if (code === "VALIDATION_FAILED" && ["name", "location", "address", "area", "cuisine"].includes(detail)) {
      return { status: 400, code, message: { name: "Check the restaurant name.", location: "Check the address.", address: "Enter the address (500 characters at most).", area: "The area can be at most 160 characters.", cuisine: "Choose 1 to 3 cuisines." }[detail] };
    }
  }
  return mapFieldRpcError(error);
}
