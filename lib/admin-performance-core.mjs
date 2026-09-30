/*
 * Admin performance summary (dashboard phase 2, CH 2026-09-29). Pure helpers shared by the
 * Overview page and scripts/test-admin-performance.mjs (browser-safe: no Node imports). The numbers themselves come
 * from public.admin_performance_summary (supabase/migrations/20260930100000_*).
 */

export const PERFORMANCE_DAYS = Object.freeze([7, 30, 90]);

/** Views needed before a restaurant's contact rate means anything. */
export const MIN_VIEWS_FOR_RATE = 20;
/** Below this many contacts per 100 restaurant views, the restaurant is flagged. */
export const LOW_CONTACT_RATE = 2;

/** `?days=` → 7 | 30 | 90, anything else → 7. */
export function parseDays(value) {
  const days = Number(value);
  return PERFORMANCE_DAYS.includes(days) ? days : 7;
}

/**
 * Change against the previous period. `null` when there is no previous period; `pct` is null
 * when the previous value was 0 (a percentage of nothing means nothing).
 */
export function compareKpi(current, previous) {
  if (previous === null || previous === undefined) return null;
  const delta = current - previous;
  const pct = previous > 0 ? Math.round((delta / previous) * 100) : null;
  return { delta, pct, direction: delta > 0 ? "up" : delta < 0 ? "down" : "same" };
}

/** Contacts per 100 restaurant views, one decimal; null without views. */
export function contactRate(contacts, views) {
  if (!views) return null;
  return Math.round((contacts / views) * 1000) / 10;
}

/** Many people look but almost nobody gets in touch: worth checking the page. */
export function isLowContact(row) {
  if (row.views < MIN_VIEWS_FOR_RATE) return false;
  const rate = contactRate(row.contacts, row.views);
  return rate !== null && rate < LOW_CONTACT_RATE;
}
