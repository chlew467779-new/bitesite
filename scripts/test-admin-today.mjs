import assert from "node:assert/strict";
import { compareIssueRows, merchantIssues } from "../lib/admin-today-core.mjs";

const now = new Date("2026-12-01T00:00:00Z");
const complete = { latitude: 3.1, longitude: 101.7, cover_image: "https://x/c.webp", phone: "+60123456789", whatsapp: null, email: null, first_published_at: "2026-11-20T00:00:00Z" };
const facts = { productCount: 5, lastStoryAt: null, isPublic: true, now };

assert.deepEqual(merchantIssues(complete, facts), [], "complete and new: no issues");
assert.deepEqual(merchantIssues({ ...complete, latitude: null }, facts), ["no_location"], "missing coordinates");
assert.deepEqual(merchantIssues({ ...complete, latitude: 0, longitude: 0 }, facts), [], "0,0 counts as set (admin form allows 0)");
assert.deepEqual(merchantIssues({ ...complete, cover_image: " " }, facts), ["no_cover"], "blank cover");
assert.deepEqual(merchantIssues(complete, { ...facts, productCount: 0 }), ["no_menu"], "no dishes");
assert.deepEqual(merchantIssues({ ...complete, phone: null }, facts), ["no_contact"], "no contact");
assert.deepEqual(merchantIssues({ ...complete, phone: null, email: "a@b.my" }, facts), [], "email is enough");

const old = { ...complete, first_published_at: "2026-08-01T00:00:00Z" };
assert.deepEqual(merchantIssues(old, facts), ["no_story"], "public 60+ days, never sent a Story");
assert.deepEqual(merchantIssues(old, { ...facts, lastStoryAt: "2026-11-01T00:00:00Z" }), [], "recent Story");
assert.deepEqual(merchantIssues(old, { ...facts, lastStoryAt: "2026-09-01T00:00:00Z" }), ["no_story"], "Story older than 60 days");
assert.deepEqual(merchantIssues(old, { ...facts, isPublic: false }), [], "not public: no Story reminder");
assert.deepEqual(merchantIssues({ ...complete, first_published_at: null }, facts), ["no_story"], "legacy public row without a publish date");

const rows = [
  { name: "B", isPublic: false, issues: ["no_menu", "no_cover"] },
  { name: "A", isPublic: true, issues: ["no_menu"] },
  { name: "C", isPublic: true, issues: ["no_menu", "no_cover"] },
];
assert.deepEqual(rows.sort(compareIssueRows).map((r) => r.name), ["C", "A", "B"], "public first, then most gaps");

console.log("admin today checks passed");
