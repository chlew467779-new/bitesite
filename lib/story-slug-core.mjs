/**
 * Story web addresses (A-01). New Stories get a slug of lowercase English letters, numbers and
 * single hyphens only, so the address is the same before and after URL encoding and the analytics
 * routes (/api/track, /api/story-view, reports) accept it. A title with no English letters or
 * numbers (for example a Chinese title) falls back to `story-YYYYMMDD`.
 *
 * Older Stories may still have a Chinese slug; the Story page decodes the address it receives so
 * those links keep working.
 */

export const STORY_SLUG_MAX_LENGTH = 60;
const BASE_MAX_LENGTH = 50;
export const STORY_SLUG_RULE_TEXT = "Use lowercase English letters, numbers and single hyphens (for example nasi-lemak-story).";

export function isValidStorySlug(value) {
  return typeof value === "string" && value.length <= STORY_SLUG_MAX_LENGTH && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

/** The part of a title that can go in a web address: accents dropped, everything else becomes a hyphen. */
export function storySlugBase(title, now = new Date()) {
  const base = String(title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, BASE_MAX_LENGTH)
    .replace(/-+$/, "");
  return base || `story-${now.toISOString().slice(0, 10).replace(/-/g, "")}`;
}

/** A slug for a new Story that no existing Story uses (`base`, then `base-1`, `base-2`, ...). */
export function makeStorySlug(title, existing, now = new Date()) {
  const taken = new Set(existing);
  const base = storySlugBase(title, now);
  if (!taken.has(base)) return base;
  let i = 1;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** The Story page's `[slug]` may arrive percent-encoded (older Chinese slugs); invalid encoding is kept as is. */
export function decodeStorySlugParam(raw) {
  if (typeof raw !== "string") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
