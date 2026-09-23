#!/usr/bin/env node
/**
 * Regression coverage for the "non-recording surface" boundary in lib/analytics.ts.
 *
 * Why this exists: the public layout components embed their own trackers. MenuViewTracker fires a
 * `menu_view` beacon as soon as the menu section scrolls into view — no click needed — and
 * ViewTracker posts straight to /api/view to bump a merchant's view count. Any surface that
 * renders those layouts without being a real customer visit (the development layout fixtures now,
 * Admin/Merchant preview later) would otherwise write real analytics rows, and a local dev server
 * normally points at the production database.
 *
 * Source-text assertions only: this repo has no jest/vitest and no DOM test environment, so the
 * behaviour of a document.querySelector lookup cannot be executed here. The assertions therefore
 * check that the guard exists, runs first, and fails closed.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(relPath) {
  return readFile(new URL(`../${relPath}`, import.meta.url), "utf8");
}

const analyticsSource = await read("lib/analytics.ts");

assert.match(
  analyticsSource,
  /export const ANALYTICS_SUPPRESSED_ATTRIBUTE = 'data-bs-analytics';/,
  "the suppression marker attribute is exported so surfaces cannot invent their own spelling",
);
assert.match(
  analyticsSource,
  /export const analyticsSuppressedProps = /,
  "a ready-made prop object exists for the wrapper element",
);
assert.match(
  analyticsSource,
  /export function isAnalyticsSuppressed\(\)/,
  "the guard is exported for trackers that do not go through trackEvent",
);
assert.match(
  analyticsSource,
  /document\.querySelector\(/,
  "suppression is detected from the DOM (present in the same commit as the trackers), not from module state",
);
assert.doesNotMatch(
  analyticsSource,
  /useEffect/,
  "the marker must not be written from an effect — that would race the trackers' own effects",
);

const guardBlock = /export function isAnalyticsSuppressed\(\): boolean \{([\s\S]*?)\n\}/.exec(analyticsSource);
assert.ok(guardBlock, "isAnalyticsSuppressed has a readable body");
assert.match(
  guardBlock[1],
  /catch \{[\s\S]*?return true;/,
  "a failed lookup must fail closed (suppress), never fall through to tracking",
);

const trackEventBlock = /export async function trackEvent\([\s\S]*?\) \{([\s\S]*?)const payload = \{/.exec(analyticsSource);
assert.ok(trackEventBlock, "trackEvent has a readable prologue");
assert.match(
  trackEventBlock[1],
  /if \(isAnalyticsSuppressed\(\)\) return;/,
  "trackEvent bails out before building or sending any payload",
);

const viewTrackerSource = await read("components/sections/view-tracker.tsx");
assert.match(
  viewTrackerSource,
  /isAnalyticsSuppressed/,
  "ViewTracker posts directly to /api/view, so it needs the guard too",
);
const viewEffect = /useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[slug\]\)/.exec(viewTrackerSource);
assert.ok(viewEffect, "ViewTracker has a readable effect body");
assert.ok(
  viewEffect[1].indexOf("isAnalyticsSuppressed") < viewEffect[1].indexOf("setTimeout"),
  "the guard runs before the request is scheduled",
);

console.log("preview analytics safety checks passed");
