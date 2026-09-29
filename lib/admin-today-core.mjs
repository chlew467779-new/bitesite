/*
 * Admin "Today" page (dashboard phase 1, CH 2026-09-29): which restaurants have gaps worth fixing.
 * Pure rules, shared by /api/admin/today and scripts/test-admin-today.mjs.
 *
 *   no_location  no latitude/longitude, so the restaurant is missing from the partner map and Nearby
 *   no_cover     no cover photo
 *   no_menu      no dishes
 *   no_contact   no phone, WhatsApp or email
 *   no_story     public for 60+ days with no Story sent in the last 60 days (CH: 60-day reminder)
 */

export const STORY_REMINDER_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ISSUE_LABELS = Object.freeze({
  no_location: "Not on the map (no coordinates)",
  no_cover: "No cover photo",
  no_menu: "No menu",
  no_contact: "No phone, WhatsApp or email",
  no_story: `No Story in ${STORY_REMINDER_DAYS} days`,
});

const hasText = (value) => typeof value === "string" && value.trim() !== "";

/**
 * @param {{ latitude?: number|null, longitude?: number|null, cover_image?: string|null, phone?: string|null,
 *   whatsapp?: string|null, email?: string|null, first_published_at?: string|null }} merchant
 * @param {{ productCount: number, lastStoryAt: string|null, isPublic: boolean, now?: Date }} facts
 * @returns {string[]} issue keys, in ISSUE_LABELS order
 */
export function merchantIssues(merchant, { productCount, lastStoryAt, isPublic, now = new Date() }) {
  const issues = [];
  if (typeof merchant.latitude !== "number" || typeof merchant.longitude !== "number") issues.push("no_location");
  if (!hasText(merchant.cover_image)) issues.push("no_cover");
  if (!(productCount > 0)) issues.push("no_menu");
  if (!hasText(merchant.phone) && !hasText(merchant.whatsapp) && !hasText(merchant.email)) issues.push("no_contact");
  if (isPublic) {
    const cutoff = now.getTime() - STORY_REMINDER_DAYS * DAY_MS;
    const since = Date.parse(merchant.first_published_at ?? "");
    const publicLongEnough = Number.isNaN(since) || since <= cutoff;
    const recentStory = lastStoryAt && Date.parse(lastStoryAt) > cutoff;
    if (publicLongEnough && !recentStory) issues.push("no_story");
  }
  return issues;
}

/** Sort key: public restaurants first, then the most gaps, then name. */
export function compareIssueRows(a, b) {
  return Number(b.isPublic) - Number(a.isPublic) || b.issues.length - a.issues.length || a.name.localeCompare(b.name);
}
