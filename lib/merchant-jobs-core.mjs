/**
 * Job posts (#23): limits, labels and request parsing shared by the Owner/Admin job routes, the
 * dashboard panels and the public job pages. The database (migration 20261004120000) checks again.
 * BiteSite stores no applicant data: visitors apply through the restaurant's WhatsApp or phone.
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const JOB_TYPES = Object.freeze([
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "temporary", label: "Temporary" },
]);
export const JOB_LIMITS = Object.freeze({ title: 80, salary: 80, hours: 120, description: 1000, openPosts: 10, days: 30 });
export const MAX_JOB_BODY_BYTES = 8 * 1024;
export const JOB_ACTIONS = Object.freeze(["close", "renew", "delete"]);

export const JOB_REPORT_REASONS = Object.freeze([
  { value: "scam", label: "It looks like a scam or asks for money" },
  { value: "misleading", label: "The details are misleading" },
  { value: "discriminatory", label: "It is unfair or discriminatory" },
  { value: "filled", label: "The job is no longer available" },
  { value: "other", label: "Something else" },
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Control characters; the description may keep line breaks (\n).
const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const invalid = (message = "Invalid request.") => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (v, allowed) => isObject(v) && Object.keys(v).every((k) => allowed.includes(k));

export function isJobId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function jobTypeLabel(value) {
  return JOB_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Field problems for the form; empty object when the job can be sent. */
export function jobFormProblems(job) {
  const problems = {};
  const text = (v) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "");
  const title = text(job?.title);
  const salary = text(job?.salary);
  const hours = text(job?.hours);
  const description = text(job?.description);
  if (title.length < 2 || title.length > JOB_LIMITS.title || CONTROL.test(title)) problems.title = `Enter the job title (2 to ${JOB_LIMITS.title} characters).`;
  if (!JOB_TYPES.some((t) => t.value === job?.jobType)) problems.jobType = "Choose full-time, part-time or temporary.";
  if (salary.length > JOB_LIMITS.salary || CONTROL.test(salary)) problems.salary = `Keep the pay under ${JOB_LIMITS.salary} characters.`;
  if (!hours || hours.length > JOB_LIMITS.hours || CONTROL.test(hours)) problems.hours = `Enter the working hours (up to ${JOB_LIMITS.hours} characters).`;
  if (!description || description.length > JOB_LIMITS.description || CONTROL_EXCEPT_NEWLINE.test(description)) problems.description = `Describe the job (up to ${JOB_LIMITS.description} characters).`;
  return problems;
}

/**
 * Owner/Admin body: `{ action: 'save', jobId, title, jobType, salary?, hours, description }` (jobId
 * is chosen by the browser for a new post, so a retry cannot create it twice) or
 * `{ action: 'close'|'renew'|'delete', jobId }`.
 */
export function parseJobRequest(body) {
  if (!isObject(body)) return invalid();
  if (!isJobId(body.jobId)) return invalid("A valid jobId is required.");
  if (body.action === "save") {
    if (!onlyKeys(body, ["action", "jobId", "title", "jobType", "salary", "hours", "description"])) return invalid();
    for (const key of ["title", "hours", "description"]) if (typeof body[key] !== "string") return invalid();
    if (body.salary != null && typeof body.salary !== "string") return invalid();
    const problems = jobFormProblems(body);
    const first = Object.values(problems)[0];
    if (first) return invalid(first);
    const clean = (v) => v.replace(/\r\n/g, "\n").trim();
    return {
      ok: true, action: "save", jobId: body.jobId.toLowerCase(), title: clean(body.title), jobType: body.jobType,
      salary: typeof body.salary === "string" && clean(body.salary) ? clean(body.salary) : null,
      hours: clean(body.hours), description: clean(body.description),
    };
  }
  if (JOB_ACTIONS.includes(body.action)) {
    if (!onlyKeys(body, ["action", "jobId"])) return invalid();
    return { ok: true, action: body.action, jobId: body.jobId.toLowerCase() };
  }
  return invalid("Unknown action.");
}

/** Admin hide/unhide: `{ jobId, hide: boolean, note? }` (a note is required to hide; the Owner sees it). */
export function parseJobHide(body) {
  if (!onlyKeys(body, ["jobId", "hide", "note"])) return invalid();
  if (!isJobId(body.jobId)) return invalid();
  if (typeof body.hide !== "boolean") return invalid();
  if (body.note != null && typeof body.note !== "string") return invalid("The note must be text.");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.hide && !note) return invalid("Say why the post is hidden. The restaurant sees this note.");
  if (note.length > 500) return invalid("The note can be at most 500 characters.");
  return { ok: true, jobId: body.jobId.toLowerCase(), hide: body.hide, note: note || null };
}

/** True when the database has no job functions yet (release SQL not run): the feature stays hidden. */
export function isJobFeatureMissing(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  return code === "PGRST202" || code === "42883" || code === "42P01" || code === "PGRST205";
}

export function mapJobRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (isJobFeatureMissing(error)) return { status: 503, code: "FEATURE_OFF", message: "Job posts are not switched on yet." };
  if (error?.code === "P0001") {
    if (code === "JOB_NOT_ALLOWED") return { status: 409, code, message: "Your restaurant page must be public before you can post jobs." };
    if (code === "JOB_LIMIT") return { status: 409, code, message: `You can have ${JOB_LIMITS.openPosts} open job posts at a time. Close one first.` };
    if (code === "RESOURCE_NOT_FOUND" && detail === "job") return { status: 404, code, message: "This job post no longer exists." };
    if (code === "VALIDATION_FAILED" && detail === "note_required") return { status: 400, code, message: "Say why the post is hidden." };
  }
  return mapFieldRpcError(error);
}

/** wa.me link with a short prefilled message, or null when the number is unusable. */
export function jobWhatsappHref(whatsapp, jobTitle, restaurantName) {
  const digits = typeof whatsapp === "string" ? whatsapp.replace(/\D/g, "") : "";
  if (digits.length < 8 || digits.length > 15) return null;
  const text = `Hi ${restaurantName}, I saw your "${jobTitle}" job post on BiteSite and would like to apply.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Days left before a post expires (0 when expired). */
export function jobDaysLeft(expiresAt, now = Date.now()) {
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - now) / 86_400_000));
}
