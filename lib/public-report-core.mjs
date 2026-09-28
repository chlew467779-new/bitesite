/**
 * Visitor reports ("Report a problem") on public restaurant and Story pages, shared by the public
 * form, /api/reports and the Admin Reports inbox. The database validates again.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const MAX_REPORT_BODY_BYTES = 4 * 1024;
export const REPORT_STATUSES = Object.freeze(["new", "resolved", "dismissed"]);

export const REPORT_REASONS = Object.freeze({
  merchant: Object.freeze([
    { value: "closed", label: "It has closed or moved" },
    { value: "hours", label: "Opening hours are wrong" },
    { value: "phone", label: "Phone or contact is wrong" },
    { value: "address", label: "Address or map location is wrong" },
    { value: "menu", label: "Menu or prices are wrong" },
    { value: "duplicate", label: "This place is listed twice" },
    { value: "fake", label: "This listing looks fake" },
    { value: "other", label: "Something else" },
  ]),
  story: Object.freeze([
    { value: "rights", label: "It uses my photo or text without permission" },
    { value: "personal_data", label: "It shows me or my personal details" },
    { value: "misleading", label: "It is misleading or untrue" },
    { value: "offensive", label: "It is offensive" },
    { value: "other", label: "Something else" },
  ]),
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message = "Invalid request.") => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (v, allowed) => isObject(v) && Object.keys(v).every((k) => allowed.includes(k));

export function reasonLabel(targetType, reason) {
  return REPORT_REASONS[targetType]?.find((r) => r.value === reason)?.label ?? reason;
}

/**
 * Public form: `{ targetType, slug, reason, note?, contactEmail?, website? }`. `website` is a
 * honeypot that people never fill: when set, the report is accepted but silently dropped.
 */
export function parseReportSubmit(body) {
  if (!onlyKeys(body, ["targetType", "slug", "reason", "note", "contactEmail", "website"])) return invalid();
  if (body.targetType !== "merchant" && body.targetType !== "story") return invalid();
  if (typeof body.slug !== "string" || body.slug.length > 200 || !SLUG_PATTERN.test(body.slug)) return invalid();
  if (!REPORT_REASONS[body.targetType].some((r) => r.value === body.reason)) return invalid("Choose what is wrong.");
  if (body.note != null && typeof body.note !== "string") return invalid();
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 1000) return invalid("Please keep the details under 1000 characters.");
  if (body.contactEmail != null && typeof body.contactEmail !== "string") return invalid();
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : "";
  if (contactEmail && (contactEmail.length > 254 || !EMAIL_PATTERN.test(contactEmail))) return invalid("Check the email address, or leave it empty.");
  const honeypot = typeof body.website === "string" && body.website.trim() !== "";
  return { ok: true, targetType: body.targetType, slug: body.slug, reason: body.reason, note: note || null, contactEmail: contactEmail || null, honeypot };
}

/** Admin: `{ id, status, note? }`. */
export function parseReportDecision(body) {
  if (!onlyKeys(body, ["id", "status", "note"])) return invalid();
  if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) return invalid();
  if (!REPORT_STATUSES.includes(body.status)) return invalid("Unknown status.");
  if (body.note != null && typeof body.note !== "string") return invalid("The note must be text.");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 1000) return invalid("The note can be at most 1000 characters.");
  return { ok: true, id: body.id, status: body.status, note: note || null };
}

export function mapReportRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001") {
    if (code === "REPORT_LIMIT") return { status: 429, code, message: "Thanks, we have received several reports from you today. Please try again tomorrow." };
    if (code === "RESOURCE_NOT_FOUND" && detail === "report_target") return { status: 404, code, message: "This page is no longer available." };
    if (code === "RESOURCE_NOT_FOUND" && detail === "report") return { status: 404, code, message: "Report not found." };
  }
  return mapFieldRpcError(error);
}
