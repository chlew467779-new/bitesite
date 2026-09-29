/*
 * Feedback about BiteSite itself (CH 2026-09-29): visitors send ideas, design comments or problems
 * from the footer's "Feedback" page, and merchant feedback topics are grouped the same way.
 * Problems are handled now; ideas and design comments are collected and handled in a batch.
 * Shared by /api/feedback, /api/admin/site-feedback, the admin inbox and scripts/test-site-feedback.mjs.
 */

export const SITE_FEEDBACK_TOPICS = Object.freeze([
  Object.freeze({ value: "feature", label: "Idea for a new feature" }),
  Object.freeze({ value: "design", label: "Design or layout" }),
  Object.freeze({ value: "problem", label: "Something is broken" }),
  Object.freeze({ value: "other", label: "Something else" }),
]);
export const SITE_FEEDBACK_STATUSES = Object.freeze(["new", "done"]);
export const SITE_FEEDBACK_MESSAGE_LIMIT = 1000;
export const MAX_SITE_FEEDBACK_BODY_BYTES = 8 * 1024;

/** Topics handled as they come in; everything else waits for the batch (CH: every 2 months). */
const URGENT_SITE_TOPICS = new Set(["problem"]);
const URGENT_MERCHANT_TOPICS = new Set(["problem", "listing"]);
export const isUrgentSiteTopic = (topic) => URGENT_SITE_TOPICS.has(topic);
export const isUrgentMerchantTopic = (topic) => URGENT_MERCHANT_TOPICS.has(topic);

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Visitor: `{ topic, message, contactEmail?, page?, website? }` (`website` is the honeypot). */
export function parseSiteFeedback(body) {
  if (!isObject(body) || Object.keys(body).some((k) => !["topic", "message", "contactEmail", "page", "website"].includes(k))) return invalid("Invalid request.");
  if (!SITE_FEEDBACK_TOPICS.some((t) => t.value === body.topic)) return invalid("Choose what your feedback is about.");
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return invalid("Write your feedback first.");
  if (message.length > SITE_FEEDBACK_MESSAGE_LIMIT) return invalid(`Feedback can be at most ${SITE_FEEDBACK_MESSAGE_LIMIT} characters.`);
  const email = typeof body.contactEmail === "string" ? body.contactEmail.trim() : "";
  if (email && (email.length > 254 || !EMAIL.test(email))) return invalid("Check the email address, or leave it empty.");
  // Only a path on this site is kept (which page the visitor came from); anything else is dropped.
  const page = typeof body.page === "string" && /^\/[^/\s]?[^\s]{0,299}$/.test(body.page) && !body.page.startsWith("//") ? body.page : null;
  const honeypot = typeof body.website === "string" && body.website.trim() !== "";
  return { ok: true, honeypot, topic: body.topic, message, contactEmail: email || null, page };
}

/** Admin: `{ ids: uuid[1..100], status: 'new'|'done' }` marks one or many at once. */
export function parseSiteFeedbackUpdate(body) {
  if (!isObject(body) || Object.keys(body).some((k) => !["ids", "status"].includes(k))) return invalid("Invalid request.");
  if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 100 || body.ids.some((id) => typeof id !== "string" || !UUID.test(id))) return invalid("Choose 1 to 100 items.");
  if (!SITE_FEEDBACK_STATUSES.includes(body.status)) return invalid("Unknown status.");
  return { ok: true, ids: [...new Set(body.ids)], status: body.status };
}

/** Whole days since `iso` (0 for today); null when there is nothing. */
export function daysWaiting(iso, now = new Date()) {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}
