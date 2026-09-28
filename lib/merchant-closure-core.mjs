/**
 * Owner temporary closure: request parsing and error mapping, shared by the route and the panel.
 * The database (public.merchant_owner_business_status) validates again.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const CLOSURE_NOTE_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });

/** `{ requestId, status: 'OPEN'|'TEMPORARILY_CLOSED', note?, reopenOn?: 'YYYY-MM-DD'|null }` */
export function parseClosureRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Invalid request.");
  if (Object.keys(body).some((k) => !["requestId", "status", "note", "reopenOn"].includes(k))) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (body.status !== "OPEN" && body.status !== "TEMPORARILY_CLOSED") return invalid("Choose open or temporarily closed.");
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") return invalid("The note must be text.");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > CLOSURE_NOTE_LIMIT) return invalid(`The note can be at most ${CLOSURE_NOTE_LIMIT} characters.`);
  if (body.reopenOn !== undefined && body.reopenOn !== null && (typeof body.reopenOn !== "string" || !DATE_PATTERN.test(body.reopenOn) || Number.isNaN(Date.parse(body.reopenOn)))) {
    return invalid("Choose a valid reopening date.");
  }
  const open = body.status === "OPEN";
  return { ok: true, requestId: body.requestId, status: body.status, note: open ? null : note || null, reopenOn: open ? null : body.reopenOn ?? null };
}

export function mapClosureRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001" && code === "VALIDATION_FAILED" && detail === "reopen_date") return { status: 400, code, message: "The reopening date must be between today and one year from now." };
  if (error?.code === "P0001" && code === "OPERATION_FORBIDDEN" && detail === "admin_business_status") return { status: 403, code, message: "Your restaurant is marked as moved or permanently closed. Contact the BiteSite team through Feedback to change this." };
  return mapFieldRpcError(error);
}
