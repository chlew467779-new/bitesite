/**
 * Merchant claim (manage an existing restaurant), shared by the claim routes, the claim page and
 * the Admin queue. The database validates again and decides.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const MAX_CLAIM_BODY_BYTES = 8 * 1024;
export const CLAIM_RELATIONSHIPS = Object.freeze([
  { value: "owner", label: "I own this restaurant" },
  { value: "manager", label: "I manage it for the owner" },
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const invalid = (message = "Invalid request.") => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (v, allowed) => isObject(v) && Object.keys(v).every((k) => allowed.includes(k));

export function isClaimSlug(value) {
  return typeof value === "string" && value.length >= 2 && value.length <= 200 && SLUG_PATTERN.test(value);
}

/** Field problems for the claim form (same limits as the database); empty object when fine. */
export function claimFormProblems(form) {
  const problems = {};
  const name = typeof form.contactName === "string" ? form.contactName.trim() : "";
  const phone = typeof form.contactPhone === "string" ? form.contactPhone.trim() : "";
  const evidence = typeof form.evidence === "string" ? form.evidence.trim() : "";
  if (!CLAIM_RELATIONSHIPS.some((r) => r.value === form.relationship)) problems.relationship = "Choose how you are connected to the restaurant.";
  if (!name || name.length > 120) problems.contactName = "Enter your name (120 characters at most).";
  if (phone.length < 5 || phone.length > 40 || !/^\+?[0-9 ()-]+$/.test(phone)) problems.contactPhone = "Enter a phone number, e.g. +60 12-345 6789.";
  if (evidence.length < 10 || evidence.length > 1000) problems.evidence = "Tell us how we can confirm it (10 to 1000 characters).";
  return problems;
}

/** Claimant: `{ requestId, action: 'submit', relationship, contactName, contactPhone, evidence }` or `{ requestId, action: 'withdraw', claimId }`. */
export function parseClaimRequest(body) {
  if (!isObject(body) || typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (body.action === "submit") {
    if (!onlyKeys(body, ["requestId", "action", "relationship", "contactName", "contactPhone", "evidence"])) return invalid();
    const problems = claimFormProblems(body);
    const first = Object.values(problems)[0];
    if (first) return invalid(first);
    return { ok: true, action: "submit", requestId: body.requestId, relationship: body.relationship, contactName: body.contactName.trim(), contactPhone: body.contactPhone.trim(), evidence: body.evidence.trim() };
  }
  if (body.action === "withdraw") {
    if (!onlyKeys(body, ["requestId", "action", "claimId"]) || typeof body.claimId !== "string" || !UUID_PATTERN.test(body.claimId)) return invalid();
    return { ok: true, action: "withdraw", requestId: body.requestId, claimId: body.claimId };
  }
  return invalid("Unknown action.");
}

/** Admin: `{ requestId, claimId, decision: 'approve'|'reject', note }`. */
export function parseClaimDecision(body) {
  if (!onlyKeys(body, ["requestId", "claimId", "decision", "note"])) return invalid();
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (typeof body.claimId !== "string" || !UUID_PATTERN.test(body.claimId)) return invalid();
  if (body.decision !== "approve" && body.decision !== "reject") return invalid("Unknown decision.");
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") return invalid("The note must be text.");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.decision === "reject" && !note) return invalid("Please explain the decision. The person who claimed sees this note.");
  if (note.length > 1000) return invalid("The note can be at most 1000 characters.");
  return { ok: true, requestId: body.requestId, claimId: body.claimId, decision: body.decision, note: note || null };
}

export const CLAIM_STATUS_TEXT = Object.freeze({
  available: null,
  already_owner: "You already manage this restaurant.",
  managed: "This restaurant is already managed by its owner on BiteSite. If you think that is wrong, contact BiteSite.",
});

export function mapClaimRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001") {
    if (code === "CLAIM_NOT_AVAILABLE") return { status: 409, code, message: CLAIM_STATUS_TEXT[detail] ?? "This restaurant cannot be claimed right now." };
    if (code === "CLAIM_ONE_PENDING") return { status: 409, code, message: "You already have a claim waiting for review. Wait for the decision or withdraw it first." };
    if (code === "CLAIM_QUEUE_FULL") return { status: 409, code, message: "Several claims for this restaurant are already waiting. Please contact BiteSite." };
    if (code === "CLAIM_OWNER_EXISTS") return { status: 409, code, message: "This restaurant already has an active Owner. Reject the claim with a note, or change the Owner in Merchant Manager first." };
    if (code === "VALIDATION_FAILED" && detail === "not_pending") return { status: 409, code, message: "This claim was already decided or withdrawn." };
    if (code === "RESOURCE_NOT_FOUND" && detail === "claim") return { status: 404, code, message: "Claim not found." };
    if (code === "RESOURCE_NOT_FOUND") return { status: 404, code, message: "Restaurant not found." };
  }
  return mapFieldRpcError(error);
}

/** A same-site Merchant path to return to after sign-in, or '/merchant'. */
export function safeMerchantNext(value) {
  if (typeof value !== "string" || value.length > 300) return "/merchant";
  if (!/^\/merchant(?:[/?#]|$)/.test(value) || value.startsWith("//") || /[\\\s]/.test(value)) return "/merchant";
  return value;
}
