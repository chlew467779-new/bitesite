/**
 * Admin change history: log-row formatting, query parsing and wiring guards.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { actorLabel, describeHistoryRow, formatValue, operationLabel, parseHistoryQuery, pathLabel } from "../lib/merchant-history-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const q = (s) => parseHistoryQuery(new URLSearchParams(s));

assert.equal(pathLabel("profile.name"), "Name");
assert.equal(pathLabel("hours.tue"), "Hours: Tuesday");
assert.equal(pathLabel("features.seasonal_popup"), "Section: seasonal popup");
assert.equal(pathLabel("some_column"), "some column");
assert.equal(operationLabel("merchant_field_patch", "update"), "Edit");
assert.equal(operationLabel("merchant_link_review:website", "update"), "Link request approved (website)");
assert.equal(operationLabel("merchant_new_thing", "update"), "merchant_new_thing", "unknown operations stay visible");
assert.equal(operationLabel(null, "insert"), "Created");
assert.equal(actorLabel("owner", "a@example.test"), "Owner a@example.test");
assert.equal(actorLabel("unknown", null), "Unknown (direct database change)");
assert.equal(formatValue(["Malaysian", "Cafe"]), "Malaysian, Cafe");
assert.equal(formatValue(null), "—");
assert.equal(formatValue(true), "on");
assert.equal(formatValue("x".repeat(300)).length, 200);

const entry = describeHistoryRow({
  id: "1", actor_type: "owner", actor_id: "00000000-0000-4000-8000-000000000001", action: "update",
  changed_paths: ["profile.name", "review_status", "slug", "tags.cuisine"],
  before: { review_status: "pending", listing_visibility: "hidden", "profile.name": "Old", "tags.cuisine": ["Malaysian"] },
  after: { review_status: "approved", listing_visibility: "hidden", "profile.name": "New", "tags.cuisine": ["Malaysian", "Cafe"] },
  revision: 7, reason: null, operation: "merchant_review:approve", created_at: "2026-09-28T10:00:00Z",
});
assert.equal(entry.operation, "Restaurant review (approve)");
assert.equal(entry.actorId, "00000000-0000-4000-8000-000000000001");
assert.deepEqual(entry.changes.map((c) => c.path), ["review_status", "profile.name", "slug", "tags.cuisine"], "state first, no unchanged state, no duplicate");
assert.deepEqual(entry.changes[0], { path: "review_status", label: "Review status", before: "pending", after: "approved" });
assert.deepEqual(entry.changes[2], { path: "slug", label: "Web address", before: null, after: null }, "name-only columns");
assert.equal(entry.changes[3].after, "Malaysian, Cafe");
assert.equal(describeHistoryRow({ id: "2", actor_type: "admin", actor_id: "legacy_admin", action: "insert", changed_paths: [], before: null, after: { review_status: "draft" }, revision: 0, reason: null, operation: null, created_at: "x" }).changes.length, 0, "creation has no diff");
assert.equal(describeHistoryRow({ id: "3", actor_type: "admin", actor_id: "legacy_admin", action: "update", changed_paths: [], before: {}, after: {}, revision: 1, reason: null, operation: null, created_at: "x" }).actorId, null, "only Owner ids are resolved");

assert.deepEqual(q(""), { ok: true, before: null, limit: 30 });
assert.deepEqual(q("before=12&limit=5"), { ok: true, before: 12, limit: 5 });
assert.equal(q("before=abc").ok, false);
assert.equal(q("limit=0").ok, false);
assert.equal(q("limit=101").ok, false);

const route = await read("app/api/admin/merchants/[merchantId]/history/route.ts");
assert.match(route, /verifyAdminToken/, "Admin only");
assert.match(route, /\.eq\('merchant_id', merchantId\)/);
assert.doesNotMatch(route, /\.(insert|update|delete|upsert)\(/, "read-only");
assert.match(await read("app/admin/components/merchant-form.tsx"), /<MerchantHistoryPanel /);

console.log("merchant history checks passed");
