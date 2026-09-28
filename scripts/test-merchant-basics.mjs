/**
 * Listing basics change requests: form diffing, request parsing, error mapping and wiring guards.
 * Database behaviour is tested by supabase/tests/basics_requests_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basicsChanges, mapBasicsRpcError, parseBasicsReview, parseOwnerBasicsRequest } from "../lib/merchant-basics-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a1";
const ID = "11111111-1111-4111-8111-111111111111";

// Only changed details are sent; the map pin is never part of an Owner request.
const current = { name: "Kopi", address: "1 Jalan", area: null, cuisine: ["Malaysian"] };
const same = { name: " Kopi ", address: "1 Jalan", area: " ", cuisine: ["Malaysian"] };
assert.deepEqual(basicsChanges(current, same), { ok: true, changes: {} });
assert.deepEqual(basicsChanges(current, { ...same, name: "Kopi Baru" }), { ok: true, changes: { "profile.name": "Kopi Baru" } });
assert.deepEqual(basicsChanges(current, { ...same, area: "Georgetown" }), { ok: true, changes: { location: { address: "1 Jalan", area: "Georgetown" } } });
assert.deepEqual(basicsChanges(current, { ...same, cuisine: ["Malaysian", "Cafe", "Cafe"] }), { ok: true, changes: { "tags.cuisine": ["Malaysian", "Cafe"] } });
assert.equal(basicsChanges(current, { ...same, name: " " }).ok, false);
assert.equal(basicsChanges(current, { ...same, address: "" }).ok, false);
assert.equal(basicsChanges(current, { ...same, cuisine: [] }).ok, false);
assert.equal(basicsChanges(current, { ...same, cuisine: ["a", "b", "c", "d"] }).ok, false);

assert.equal(parseOwnerBasicsRequest({ requestId: REQ, action: "request", changes: { "profile.name": "X" } }).ok, true);
assert.equal(parseOwnerBasicsRequest({ requestId: REQ, action: "request", changes: { location: { address: "x", area: null } } }).ok, true);
assert.equal(parseOwnerBasicsRequest({ requestId: REQ, action: "request", changes: { location: { address: "x", latitude: 1 } } }).ok, false, "no coordinates from Owners");
assert.equal(parseOwnerBasicsRequest({ requestId: REQ, action: "request", changes: { slug: "x" } }).ok, false, "slug is not a basics path");
assert.equal(parseOwnerBasicsRequest({ requestId: REQ, action: "request", changes: {} }).ok, false);
assert.equal(parseOwnerBasicsRequest({ requestId: REQ, action: "request", changes: { "profile.name": "X" }, merchantId: ID }).ok, false, "no merchant in the body");
assert.equal(parseOwnerBasicsRequest({ requestId: REQ, action: "withdraw", basicsRequestId: ID }).ok, true);
assert.equal(parseOwnerBasicsRequest({ requestId: "x", action: "withdraw", basicsRequestId: ID }).ok, false);
assert.equal(parseBasicsReview({ requestId: REQ, basicsRequestId: ID, decision: "reject", note: " " }).ok, false, "reject needs a note");
assert.equal(parseBasicsReview({ requestId: REQ, basicsRequestId: ID, decision: "approve" }).ok, true);
assert.equal(parseBasicsReview({ requestId: REQ, basicsRequestId: ID, decision: "approve", note: "x".repeat(501) }).ok, false);

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapBasicsRpcError(rpc("BASICS_CHANGED_SINCE_REQUEST")).status, 409);
assert.equal(mapBasicsRpcError(rpc("FIELD_NOT_WRITABLE", "basics_edit_directly")).status, 409);
assert.equal(mapBasicsRpcError(rpc("VALIDATION_FAILED", "cuisine")).message, "Choose 1 to 3 cuisines.");
assert.equal(mapBasicsRpcError(rpc("MERCHANT_SUSPENDED")).status, 403);
assert.equal(mapBasicsRpcError({ code: "XX000", message: "boom" }).status, 500);

const owner = await read("app/api/merchant/restaurants/[merchantId]/basics/route.ts");
assert.match(owner, /requireMerchantUser\(request\)/);
assert.match(owner, /p_actor_type: 'owner', p_actor_id: auth\.user\.id/);
assert.doesNotMatch(owner, /merchant_basics_review|merchant_basics_queue/, "Owners cannot review");
const admin = await read("app/api/admin/basics-reviews/route.ts");
assert.match(admin, /verifyAdminToken/);
assert.match(admin, /p_actor_id: ADMIN_PRINCIPAL/);
assert.match(await read("app/admin/page.tsx"), /<BasicsReviewQueue searchQuery=\{changeRequestSearch\} \/>/);
assert.match(await read("app/api/admin/attention/route.ts"), /count\('merchant_basics_requests'\)/, "the badge counts basics requests");
const page = await read("app/merchant/page.tsx");
assert.match(page, /!listing\.basicsEditable && <BasicsRequests /, "requests only when basics are not directly editable");
const form = await read("app/merchant/components/basics-requests.tsx");
assert.match(form, /min-h-11/, "44px targets on phones");
assert.doesNotMatch(form, /latitude|longitude/, "Owners never send coordinates");
const migration = await read("supabase/migrations/20260928090000_merchant_basics_requests.sql");
assert.match(migration, /public\.merchant_field_patch\(p_actor_type, p_actor_id, m\.id, p_request_id, v_patches\)/, "approval goes through the field-save contract");
assert.match(migration, /revoke all on table public\.merchant_basics_requests from public, anon, authenticated/);

console.log("merchant basics request checks passed");
