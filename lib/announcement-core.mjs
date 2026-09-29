/*
 * Homepage pop-up (CH 2026-09-29): Admin input checks, shared by /api/admin/announcements and
 * scripts/test-announcements.mjs. The database repeats the same limits as constraints.
 */

export const ANNOUNCEMENT_LIMITS = Object.freeze({ title: 80, body: 300, linkLabel: 30, url: 2048 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["title", "body", "imageUrl", "linkUrl", "linkLabel", "isActive", "startsAt", "endsAt"];

const fail = (message) => ({ ok: false, message });
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const optionalText = (value, max, label) => {
  if (value === null || value === undefined) return { value: null };
  if (typeof value !== "string") return { error: `${label} must be text.` };
  const text = value.trim();
  if (!text) return { value: null };
  if (text.length > max) return { error: `${label}: use ${max} characters or fewer.` };
  return { value: text };
};
const optionalDate = (value, label) => {
  if (value === null || value === undefined || value === "") return { value: null };
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return { error: `${label} is not a valid date.` };
  return { value: new Date(value).toISOString() };
};

/** A link is https:// or a path on this site ("/join-us"); anything else is refused. */
export function isAnnouncementLink(value) {
  return typeof value === "string" && (/^https:\/\/[^\s]+$/.test(value) || /^\/[^/\s][^\s]*$/.test(value) || value === "/");
}

/** Parse the full form (create or replace). Returns `{ ok, row }` in database column names. */
export function parseAnnouncement(input) {
  if (!isObject(input)) return fail("Invalid request.");
  if (Object.keys(input).some((key) => !FIELDS.includes(key))) return fail("Unknown field.");
  const title = optionalText(input.title, ANNOUNCEMENT_LIMITS.title, "Title");
  const body = optionalText(input.body, ANNOUNCEMENT_LIMITS.body, "Text");
  const image = optionalText(input.imageUrl, ANNOUNCEMENT_LIMITS.url, "Image");
  const linkUrl = optionalText(input.linkUrl, ANNOUNCEMENT_LIMITS.url, "Button link");
  const linkLabel = optionalText(input.linkLabel, ANNOUNCEMENT_LIMITS.linkLabel, "Button text");
  const startsAt = optionalDate(input.startsAt, "Start");
  const endsAt = optionalDate(input.endsAt, "End");
  const problem = [title, body, image, linkUrl, linkLabel, startsAt, endsAt].find((part) => part.error);
  if (problem) return fail(problem.error);
  if (!title.value && !image.value) return fail("Add a title or an image.");
  if (image.value && !/^https:\/\//.test(image.value)) return fail("Upload the image again.");
  if (Boolean(linkUrl.value) !== Boolean(linkLabel.value)) return fail("A button needs both its text and its link.");
  if (linkUrl.value && !isAnnouncementLink(linkUrl.value)) return fail("The button link must start with https:// or / (a page on BiteSite).");
  if (startsAt.value && endsAt.value && Date.parse(endsAt.value) <= Date.parse(startsAt.value)) return fail("The end must be after the start.");
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") return fail("Invalid on/off value.");
  return {
    ok: true,
    row: {
      title: title.value, body: body.value, image_url: image.value, link_url: linkUrl.value, link_label: linkLabel.value,
      is_active: input.isActive === true, starts_at: startsAt.value, ends_at: endsAt.value,
    },
  };
}

export function isAnnouncementId(value) {
  return typeof value === "string" && UUID.test(value);
}

/** Whether a row is showing to visitors at `now` (same rule as the database read policy). */
export function isAnnouncementLive(row, now = new Date()) {
  if (!row?.is_active) return false;
  const t = now.getTime();
  return (!row.starts_at || Date.parse(row.starts_at) <= t) && (!row.ends_at || Date.parse(row.ends_at) > t);
}
