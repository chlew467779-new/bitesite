/**
 * Merchant feedback (SYNC-052), shared by the Owner/Admin routes and the feedback UI. The
 * database (public.merchant_feedback_*) authorizes, validates again and stores.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const FEEDBACK_TOPICS = Object.freeze([
  { value: "suggestion", label: "Suggestion" },
  { value: "problem", label: "Something is not working" },
  { value: "listing", label: "Question about my listing" },
]);
export const FEEDBACK_STATUSES = Object.freeze(["new", "read", "resolved"]);
export const FEEDBACK_MESSAGE_LIMIT = 2000;
export const FEEDBACK_REPLY_LIMIT = 1000;
export const MAX_FEEDBACK_BODY_BYTES = 12 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const onlyKeys = (body, keys) => body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).every((key) => keys.includes(key));

/** Owner: `{ requestId, topic, message }`. */
export function parseFeedbackSubmit(body) {
  if (!onlyKeys(body, ["requestId", "topic", "message"])) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  if (!FEEDBACK_TOPICS.some((t) => t.value === body.topic)) return invalid("Choose a topic.");
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return invalid("Write your feedback first.");
  if (message.length > FEEDBACK_MESSAGE_LIMIT) return invalid(`Feedback can be at most ${FEEDBACK_MESSAGE_LIMIT} characters.`);
  return { ok: true, requestId: body.requestId, topic: body.topic, message };
}

/** Admin: `{ id, status, reply }`. */
export function parseFeedbackUpdate(body) {
  if (!onlyKeys(body, ["id", "status", "reply"])) return invalid("Invalid request.");
  if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) return invalid("Invalid request.");
  if (!FEEDBACK_STATUSES.includes(body.status)) return invalid("Unknown status.");
  if (body.reply !== undefined && body.reply !== null && typeof body.reply !== "string") return invalid("The reply must be text.");
  const reply = typeof body.reply === "string" ? body.reply.trim() : "";
  if (reply.length > FEEDBACK_REPLY_LIMIT) return invalid(`The reply can be at most ${FEEDBACK_REPLY_LIMIT} characters.`);
  return { ok: true, id: body.id, status: body.status, reply: reply || null };
}

export function mapFeedbackRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001" && code === "RATE_LIMITED") return { status: 429, code, message: "You have sent a lot of feedback in the last hour. Please try again later." };
  if (error?.code === "P0001" && code === "RESOURCE_NOT_FOUND" && detail === "feedback") return { status: 404, code, message: "This feedback no longer exists." };
  return mapFieldRpcError(error);
}
