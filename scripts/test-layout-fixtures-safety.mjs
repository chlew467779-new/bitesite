#!/usr/bin/env node
/**
 * Safety checks for the development-only layout fixtures page.
 *
 * The page renders the real public layout components, so it is the one place in the app where
 * production-shaped UI runs against invented data. These assertions keep it harmless: unreachable
 * outside a local dev server, no database or auth access, no analytics writes, and no value from
 * the query string reaching the page.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/dev/layout-fixtures/page.tsx", import.meta.url), "utf8");
const fixtures = await readFile(new URL("../app/dev/layout-fixtures/fixtures.ts", import.meta.url), "utf8");
const both = `${source}\n${fixtures}`;

/* ── unreachable outside development ───────────────────────────────────────────────────────── */

assert.match(
  source,
  /if \(process\.env\.NODE_ENV !== "development"\) notFound\(\);/,
  "the page 404s unless it is running on a development server",
);

const body = /export default async function LayoutFixturesPage\([\s\S]*?\) \{([\s\S]*?)\n\}/.exec(source);
assert.ok(body, "the page component has a readable body");
const guardIndex = body[1].indexOf('process.env.NODE_ENV !== "development"');
assert.ok(guardIndex > -1, "the guard is inside the component");
const beforeGuard = body[1].slice(0, guardIndex);
assert.doesNotMatch(beforeGuard, /await |searchParams|build[A-Z]/, "nothing runs before the guard");
assert.match(source, /export const dynamic = "force-dynamic";/, "the page is never prerendered or cached");
assert.match(source, /robots: \{ index: false, follow: false \}/, "the page is noindex, nofollow");

/* ── no data, auth or tracker access ───────────────────────────────────────────────────────── */

for (const forbidden of [
  "@/lib/supabase",
  "@/lib/supabase-admin",
  "@/lib/admin-auth",
  "auth-context",
  "page-view-tracker",
  "view-tracker",
  "menu-view-tracker",
  "trackEvent",
  "fetch(",
]) {
  assert.ok(!both.includes(forbidden), `the fixtures must not reference ${forbidden}`);
}

// It may import the suppression marker itself — that is the opposite of tracking, and importing it
// keeps the attribute spelling in one place.
assert.match(
  source,
  /import \{ analyticsSuppressedProps \} from "@\/lib\/analytics";/,
  "the preview declares itself a non-recording surface",
);
assert.match(
  source,
  /<div \{\.\.\.analyticsSuppressedProps\}>\s*\n\s*<LayoutComponent/,
  "the marker wraps the layout, so it is in the DOM before the layout's trackers run",
);

/* ── fixtures are literals, and the query string only selects between them ─────────────────── */

assert.match(fixtures, /export const FIXTURE_CATEGORIES: Category\[\] = \[/, "categories are in-memory literals");
assert.match(fixtures, /export function buildProducts\(/, "dishes are built in-memory");
assert.match(fixtures, /export function buildMerchant\(/, "the merchant is built in-memory");
assert.match(
  fixtures,
  /data:image\/svg\+xml/,
  "images are an inline placeholder — no external host, and nothing shipped in /public",
);
assert.doesNotMatch(both, /https?:\/\/(?!www\.w3\.org|example\.com)/, "no external URLs are fetched or rendered");

assert.match(
  fixtures,
  /export function pick<T extends string>\(value: string \| string\[\] \| undefined, allowed: readonly T\[\], fallback: T\)/,
  "query parameters are narrowed to a fixed set of states",
);
assert.match(
  source,
  /resolveRegisteredLayoutKey\(params\.layout\)/,
  "the layout parameter goes through the registry resolver, not straight into a lookup",
);
assert.doesNotMatch(
  source,
  /dangerouslySetInnerHTML|\{params\.[a-z]+\}/,
  "no raw query value is ever rendered",
);

/* ── the fixture covers the states the visual QA needs ─────────────────────────────────────── */

for (const state of ["normal", "discount", "hidden", "soldout-hidden", "featured-hidden", "with", "without", "all"]) {
  assert.ok(both.includes(`"${state}"`), `the fixtures offer the ${state} state`);
}
assert.match(fixtures, /category_id: null/, "an uncategorized dish is present, to show it never renders publicly");

// sections=all adds the reviews, appointment and events sections so every themed section can be
// reviewed on every layout. Their data is in-memory too, and the switch is a fixed state.
assert.match(
  source,
  /const sections = pick\(params\.sections, SECTION_STATES, "default"\);/,
  "the sections parameter is narrowed to a fixed set of states",
);
assert.match(fixtures, /export const FIXTURE_REVIEWS: Review\[\] = \[/, "reviews are in-memory literals");
assert.match(fixtures, /export function buildEvents\(/, "events are built in-memory");
for (const feature of ["reviews", "appointment", "events"]) {
  assert.match(fixtures, new RegExp(`${feature}: allSections,`), `${feature} is only switched on by sections=all`);
}
assert.match(source, /events=\{events\}/, "the fixture events reach the layout");

console.log("layout fixtures safety checks passed");
