/**
 * D2-A field save contract (HTTP side) and wiring guards.
 *
 * Behaviour: lib/merchant-field-patch-core.mjs request parsing, RPC error mapping and response
 * envelopes. Consistency: the JS registry equals private.merchant_field_registry() in the
 * migration. Source wiring: the Owner/Admin endpoints and the two Merchant insert routes call the
 * RPCs with a server-built actor. The database behaviour itself is tested by
 * supabase/tests/d2a_field_cas_behavior_tests.sql and scripts/test-d2a-concurrency-local.mjs.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  MERCHANT_FIELD_REGISTRY,
  fieldPatchResponse,
  isWritablePath,
  mapFieldRpcError,
  parseFieldPatchRequest,
} from "../lib/merchant-field-patch-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2a001";
const req = (patches, extra = {}) => ({ requestId: REQ, patches, ...extra });
const p = (path, expected, value) => ({ path, expected, value });
const ex = (value) => ({ exists: true, value });
const ABSENT = { exists: false };
const rejects = (body, actor, status, code, label) => {
  const result = parseFieldPatchRequest(body, actor);
  assert.equal(result.ok, false, `${label}: rejected`);
  assert.equal(result.status, status, `${label}: status ${result.status}`);
  assert.equal(result.code, code, `${label}: code ${result.code}`);
  return result;
};

/* ── registry matches the migration ────────────────────────────────────────────────────────── */

const migrationFiles = (await readdir(new URL("../supabase/migrations/", import.meta.url))).sort();
const migrations = migrationFiles.filter((f) => f.endsWith("_merchant_field_cas.sql"));
assert.equal(migrations.length, 1, "exactly one D2-A migration");
const migration = await read(`supabase/migrations/${migrations[0]}`);
// The registry as defined by the newest migration that (re)creates it.
let registrySource = "";
for (const file of migrationFiles) {
  const text = await read(`supabase/migrations/${file}`);
  if (text.includes("create or replace function private.merchant_field_registry()")) registrySource = text;
}
const registrySql = registrySource.slice(registrySource.indexOf("create or replace function private.merchant_field_registry()"));
// Outside the listing-basics wrapper, the scoped Owner permission is false.
const normalRegistrySql = registrySql.replaceAll("private.merchant_listing_basics_enabled()", "false");
const sqlRows = [...normalRegistrySql.slice(0, normalRegistrySql.indexOf("$;")).matchAll(/\('([a-z_.]+)',\s*'(\w+)',\s*'(\w+)',\s*(true|false),\s*(true|false),\s*(\d+|null)\)/g)]
  .map(([, path, kind, target, owner, admin, max]) => ({ path, kind, target, owner: owner === "true", admin: admin === "true", maxLength: max === "null" ? null : Number(max) }));
assert.deepEqual(sqlRows, MERCHANT_FIELD_REGISTRY.map((row) => ({ ...row })), "JS registry equals the database registry");

for (const row of MERCHANT_FIELD_REGISTRY) {
  if (/^profile\.(website|instagram|facebook|menu_pdf_url)$/.test(row.path)) assert.ok(!row.owner && !row.admin, `${row.path}: links are closed for both`);
  // Migration 20261003150000 (issue #11): Owners set six section switches, never events/menu/reviews.
  if (row.kind === "feature") assert.equal(row.owner, ["hero", "about", "contact", "gallery", "appointment", "seasonal_popup"].includes(row.target), `${row.path}: Owner switch rule`);
}
assert.ok(!isWritablePath("features.menu", "admin") && !isWritablePath("features.reviews", "admin"), "menu/reviews features are protected");
for (const column of ["name", "slug", "address", "layout", "is_published", "platform_status", "review_status", "listing_visibility", "platform_restriction", "business_status", "settings", "reviews"]) {
  assert.ok(!MERCHANT_FIELD_REGISTRY.some((row) => row.kind === "text" && row.target === column && column !== "name"), `${column} is not a patch target`);
}

/* ── request parsing ───────────────────────────────────────────────────────────────────────── */

let ok = parseFieldPatchRequest(req([p("profile.tagline", ex(null), "  Fresh bakes  "), p("hours.tue", ABSENT, "10:00 - 18:00")]), "owner");
assert.equal(ok.ok, true, JSON.stringify(ok));
assert.equal(ok.patches[0].value, "Fresh bakes", "text is trimmed");
ok = parseFieldPatchRequest(req([p("profile.tagline", ex("A"), null), p("hours.mon", ex("09:00 - 17:00"), null)]), "owner");
assert.equal(ok.ok, true, "null clears text and removes a day");
ok = parseFieldPatchRequest(req([p("features.gallery", ex(false), true)]), "admin");
assert.equal(ok.ok, true, "Admin sets a registered feature");
assert.equal(parseFieldPatchRequest(req([p("profile.tagline", ex(null), "x")]), "owner").requestId, REQ);

rejects(null, "owner", 400, "INVALID_JSON", "null body");
rejects([], "owner", 400, "INVALID_JSON", "array body");
rejects(req([p("profile.tagline", ex(null), "x")], { actor: "admin" }), "owner", 400, "UNKNOWN_FIELD", "body actor");
rejects(req([p("profile.tagline", ex(null), "x")], { userId: "x", merchantId: "y" }), "owner", 400, "UNKNOWN_FIELD", "body identity");
rejects(JSON.parse('{"requestId":"7d1c3a52-5b1e-4c8e-9a51-0e2c55d2a001","patches":[],"__proto__":{"x":1}}'), "owner", 400, "UNKNOWN_FIELD", "prototype key is refused");
rejects({ requestId: "nope", patches: [p("profile.tagline", ex(null), "x")] }, "owner", 400, "VALIDATION_FAILED", "requestId must be a UUID");
rejects(req([]), "owner", 400, "VALIDATION_FAILED", "empty patches");
rejects(req(Array.from({ length: 51 }, () => p("profile.tagline", ex(null), "x"))), "owner", 400, "VALIDATION_FAILED", "too many patches");
rejects(req([{ path: "profile.tagline", value: "x" }]), "owner", 400, "VALIDATION_FAILED", "missing expected");
rejects(req([{ path: "profile.tagline", expected: ex(null), value: "x", extra: 1 }]), "owner", 400, "VALIDATION_FAILED", "extra patch key");
rejects(req([p("profile.tagline", { exists: true }, "x")]), "owner", 400, "VALIDATION_FAILED", "exists without value");
rejects(req([p("hours.mon", { exists: false, value: null }, "10:00 - 18:00")]), "owner", 400, "VALIDATION_FAILED", "absent with value");
rejects(req([p("profile.tagline", { exists: "true", value: null }, "x")]), "owner", 400, "VALIDATION_FAILED", "exists not boolean");
rejects(req([p("profile.name", ex("x"), "y")]), "owner", 400, "FIELD_NOT_WRITABLE", "Owner cannot rename (Admin-only, B0)");
rejects(req([p("profile.slug", ex("x"), "y")]), "admin", 400, "UNKNOWN_FIELD", "slug is not a patch path");

/* B0: Admin-only name, layout, tags, location */
ok = parseFieldPatchRequest(req([
  p("profile.name", ex("Old"), " New Name "),
  p("presentation.layout", ex("classic"), "rustic"),
  p("tags.cuisine", ex(["Cafe"]), [" Cafe ", "Bakery"]),
  p("location", ex({ address: "a", area: null, latitude: 1, longitude: 2 }), { address: " 2 Jalan ", area: null, latitude: 0, longitude: 0 }),
]), "admin");
assert.equal(ok.ok, true, JSON.stringify(ok));
assert.deepEqual(ok.patches.map((x) => x.value), ["New Name", "rustic", ["Cafe", "Bakery"], { address: "2 Jalan", area: null, latitude: 0, longitude: 0 }], "values cleaned; coordinate 0 kept");
for (const path of ["profile.name", "tags.cuisine", "location"]) assert.ok(!isWritablePath(path, "owner"), `${path} is Admin-only`);
assert.ok(isWritablePath("presentation.layout", "owner"), "Owners choose their page style (issue #11)");
let bad = rejects(req([p("presentation.layout", ex("classic"), "chinese")]), "admin", 400, "VALIDATION_FAILED", "layout on hold");
assert.ok(bad.fieldErrors["presentation.layout"]);
rejects(req([p("profile.name", ex("Old"), null)]), "admin", 400, "VALIDATION_FAILED", "name cannot be cleared");
bad = rejects(req([p("tags.cuisine", ex([]), ["Cafe", "Cafe"])]), "admin", 400, "VALIDATION_FAILED", "duplicate tags");
assert.ok(bad.fieldErrors["tags.cuisine"]);
rejects(req([p("tags.occasion", ex([]), ["A", "B", "C", "D"])]), "admin", 400, "VALIDATION_FAILED", "too many occasion tags");
rejects(req([p("tags.cuisine", ex([]), "Cafe")]), "admin", 400, "VALIDATION_FAILED", "tags must be a list");
for (const [value, label] of [
  [{ address: "a", area: null, latitude: 1 }, "missing key"],
  [{ address: "a", area: null, latitude: 1, longitude: null }, "one coordinate"],
  [{ address: "a", area: null, latitude: 91, longitude: 0 }, "latitude range"],
  [{ address: "a", area: null, latitude: "3", longitude: "101" }, "string coordinates"],
  [{ address: "  ", area: null, latitude: null, longitude: null }, "blank address"],
  [{ address: "a", area: null, latitude: Number.NaN, longitude: 0 }, "NaN"],
]) rejects(req([p("location", ABSENT, value)]), "admin", 400, "VALIDATION_FAILED", `location: ${label}`);
rejects(req([p("operating_hours", ex({}), {})]), "owner", 400, "UNKNOWN_FIELD", "column name instead of path");
rejects(req([p("features.anything", ABSENT, true)]), "admin", 400, "UNKNOWN_FIELD", "unregistered feature");
rejects(req([p("profile.tagline", ex(null), "x"), p("profile.tagline", ex(null), "y")]), "owner", 400, "VALIDATION_FAILED", "duplicate path");
const link = rejects(req([p("profile.website", ex(null), "https://x.test")]), "owner", 400, "FIELD_NOT_WRITABLE", "Owner link");
assert.match(link.message, /Links are checked by the BiteSite team/);
rejects(req([p("profile.facebook", ex(null), "https://x.test")]), "admin", 400, "FIELD_NOT_WRITABLE", "Admin link");
rejects(req([p("features.events", ex(false), true)]), "owner", 400, "FIELD_NOT_WRITABLE", "Owner events switch stays closed");
rejects(req([p("features.menu", ex(true), false)]), "admin", 400, "FIELD_NOT_WRITABLE", "menu feature");
rejects(req([p("profile.tagline", ex(null), 5)]), "owner", 400, "VALIDATION_FAILED", "number for text");
rejects(req([p("profile.tagline", ex(null), "   ")]), "owner", 400, "VALIDATION_FAILED", "blank text");
rejects(req([p("features.gallery", ex(false), "true")]), "admin", 400, "VALIDATION_FAILED", "string for feature");
const long = rejects(req([p("profile.tagline", ex(null), "x".repeat(301))]), "owner", 400, "VALIDATION_FAILED", "too long");
assert.ok(long.fieldErrors?.["profile.tagline"], "length error is per field");
const hours = rejects(req([p("hours.mon", ABSENT, "whenever")]), "owner", 400, "VALIDATION_FAILED", "free-text hours");
assert.ok(hours.fieldErrors?.["hours.mon"], "hours error is per field");
const email = rejects(req([p("profile.email", ex(null), "not-an-email")]), "owner", 400, "VALIDATION_FAILED", "email format");
assert.ok(email.fieldErrors?.["profile.email"], "email format error is per field");
rejects(req([p("profile.tagline", ex(null), "x")]), "system", 400, "FIELD_NOT_WRITABLE", "unknown actor");

/* ── RPC error mapping and response envelopes ──────────────────────────────────────────────── */

const map = (message, details = "") => mapFieldRpcError({ code: "P0001", message, details });
assert.deepEqual([map("RESOURCE_NOT_FOUND").status, map("MERCHANT_SUSPENDED").status, map("OPERATION_FORBIDDEN").status], [404, 403, 403]);
assert.deepEqual([map("PUBLIC_CONTACT_MINIMUM").status, map("IDEMPOTENCY_KEY_REUSED").status, map("IDEMPOTENCY_KEY_EXPIRED").status], [422, 409, 409]);
assert.match(map("FIELD_NOT_WRITABLE", "profile.instagram").message, /Links/);
assert.match(map("OPERATION_FORBIDDEN", "pending_review").message, /waiting for review/);
const internal = mapFieldRpcError({ code: "42501", message: "permission denied for table merchants" });
assert.equal(internal.status, 500);
assert.doesNotMatch(internal.message, /permission|merchants|42501/, "internal errors do not leak database text");
assert.equal(mapFieldRpcError({ code: "P0001", message: "SOMETHING_ELSE" }).status, 500, "unknown codes are 500");

const conflict = fieldPatchResponse({ status: "conflict", conflicts: [{ path: "profile.phone", expected: ex("1"), current: ex("2"), proposed: "3" }], revision: 7, replayed: false }, REQ);
assert.equal(conflict.status, 409);
assert.equal(conflict.body.error.code, "FIELD_CONFLICT");
assert.equal(conflict.body.error.conflicts[0].current.value, "2");
assert.equal(conflict.body.revision, 7);
const applied = fieldPatchResponse({ status: "applied", values: { "profile.phone": ex("3") }, changedPaths: ["profile.phone"], revision: 8, replayed: true }, REQ);
assert.equal(applied.status, 200);
assert.deepEqual([applied.body.data.status, applied.body.revision, applied.body.replayed, applied.body.requestId], ["applied", 8, true, REQ]);
const noop = fieldPatchResponse({ status: "noop", revision: 8, values: { "profile.phone": ex("3"), "hours.sun": ABSENT }, replayed: true }, REQ);
assert.equal(noop.body.data.status, "noop");
assert.deepEqual(noop.body.data.values, { "profile.phone": ex("3"), "hours.sun": ABSENT }, "no-op responses preserve confirmed snapshots");
assert.equal(noop.body.replayed, true);
assert.equal(fieldPatchResponse(null, REQ).status, 500);

/* ── wiring (source level) ─────────────────────────────────────────────────────────────────── */

const runner = await read("app/api/_lib/merchant-field-patch.ts");
assert.match(runner, /^import 'server-only';/m);
assert.match(runner, /export const ADMIN_PRINCIPAL = 'legacy_admin';/);
assert.match(runner, /supabase\.rpc\(basics \? 'merchant_listing_basics_patch' : 'merchant_field_patch'/);
assert.match(runner, /parseFieldPatchRequest\(body, basics \? 'admin' : actor\.type\)/, "only the scoped basics parser uses Admin shapes; RPC still uses actorArgs(actor)");
assert.doesNotMatch(runner, /\.from\('merchants'\)\s*\.update|\.update\(/, "no direct merchant UPDATE");
assert.ok(runner.indexOf("supabase.rpc(basics ? ") < runner.indexOf("revalidateMerchant(merchantId)"), "revalidation after the committed RPC");
assert.match(runner, /if \(result\?\.status === 'applied'\) await revalidateMerchant/, "only applied saves (including replays) refresh pages");

const ownerRoute = await read("app/api/merchant/restaurants/[merchantId]/fields/route.ts");
assert.match(ownerRoute, /requireMerchantUser\(request\)/);
assert.equal((ownerRoute.match(/\{ type: 'owner', userId: auth\.user\.id \}/g) || []).length, 2, "Owner actor is the verified user on GET and PATCH");
const adminRoute = await read("app/api/admin/merchants/[merchantId]/fields/route.ts");
assert.match(adminRoute, /verifyAdminToken\(token\)/);
assert.equal((adminRoute.match(/\{ type: 'admin' \}/g) || []).length, 2, "Admin actor on GET and PATCH");
for (const source of [ownerRoute, adminRoute]) assert.doesNotMatch(source, /body\.|await request\.json/, "routes do not read identity from the body");

const stories = await read("app/api/merchant/story-submissions/route.ts");
assert.match(stories, /supabase\.rpc\('merchant_story_submission_create', \{\s*p_user_id: context\.user\.id,\s*p_merchant_id: context\.merchant\.id,/);
assert.doesNotMatch(stories, /from\('story_submissions'\)\.insert/, "no direct Story insert");
assert.doesNotMatch(stories, /merchant_slug:|submitted_by:|channel:|status: 'pending_review'/, "server-set Story fields are set in the database");
const changes = await read("app/api/merchant/profile-change-requests/route.ts");
assert.match(changes, /supabase\.rpc\('merchant_profile_change_request_create', \{\s*p_user_id: context\.user\.id,\s*p_merchant_id: context\.merchant\.id,/);
assert.doesNotMatch(changes, /\.insert\(/, "no direct change-request insert");
for (const source of [stories, changes]) assert.match(source, /error\.code === '23505'/, "pending uniqueness still maps to 409");

/* ── migration shape ───────────────────────────────────────────────────────────────────────── */

for (const fn of ["merchant_field_patch", "merchant_field_snapshot_read", "merchant_story_submission_create", "merchant_profile_change_request_create", "request_idempotency_purge_expired"]) {
  const body = migration.slice(migration.indexOf(`function public.${fn}(`));
  assert.match(body.slice(0, body.indexOf("as $$")), /security invoker\s+set search_path = ''/, `${fn}: invoker, empty search_path`);
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`), `${fn}: revoked from public roles`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`), `${fn}: service_role only`);
}
assert.match(migration, /private\.lock_merchant_for_actor\(p_actor_type, p_actor_id, p_merchant_id, true\)/, "the patch RPC authorizes and locks before reading the key");
assert.match(migration, /for update;\s*if not found then\s*perform private\.merchant_write_error\('RESOURCE_NOT_FOUND'\);\s*end if;\s*elsif p_actor_type = 'admin'/, "the Owner membership is locked FOR UPDATE and rechecked");
assert.doesNotMatch(migration, /security definer/i, "no SECURITY DEFINER");
assert.doesNotMatch(migration.slice(migration.indexOf("function public.merchant_field_patch(")), /revision\s*=\s*[^=]*\+\s*1/, "the RPC never bumps revision itself");

// Regression guards complement the executable SQL behavior suite.
const lockBody = migration.slice(migration.indexOf("function private.lock_merchant_for_actor("), migration.indexOf("-- 3b)"));
assert.match(lockBody, /if p_actor_type = 'owner' then[\s\S]*MERCHANT_SUSPENDED[\s\S]*end if;\s*end if;\s*if m\.platform_restriction = 'archived'/, "archived guard applies outside the Owner-only suspended guard");
const noopBody = migration.slice(migration.indexOf("if cardinality(changed_paths) = 0 then"), migration.indexOf("if (select count(*) from unnest(changed_paths) p where p like 'hours.%')"));
assert.match(noopBody, /for patch in select value from jsonb_array_elements\(p_patches\) loop/);
assert.match(noopBody, /private\.merchant_field_snapshot\(m, reg\.kind, reg\.target\)/);
assert.match(noopBody, /'values', values_out/, "no-op stores all confirmed snapshots for replay");
assert.doesNotMatch(noopBody, /update public\.merchants/, "no-op does not update merchant rows");

/* ── B0 forward keeps the fixes; B0 rollback restores the current D2-A ───────────────────── */

const b0File = migrationFiles.find((f) => f.endsWith("_merchant_field_cas_admin_fields.sql"));
assert.ok(b0File, "B0 migration present");
const b0 = await read(`supabase/migrations/${b0File}`);
const rollback = await read(`supabase/rollback/${b0File.replace(/\.sql$/, ".rollback.STAGING_ONLY.sql")}`);
const fnBlocks = (text) => Object.fromEntries([...text.matchAll(/^create or replace function ([\w.]+)\(/gm)]
  .map((m) => [m[1], text.slice(m.index, text.indexOf("\n$$;", m.index) + 4)]));
const d2aFns = fnBlocks(migration);
const b0Fns = fnBlocks(b0);
const rollbackFns = fnBlocks(rollback);
const replacedByB0 = Object.keys(b0Fns).filter((fn) => fn !== "private.merchant_persistable_layouts");
assert.deepEqual(Object.keys(rollbackFns).sort(), replacedByB0.sort(), "the B0 rollback restores every D2-A function B0 replaces");
for (const fn of replacedByB0) {
  assert.ok(d2aFns[fn], `${fn} exists in D2-A`);
  assert.equal(rollbackFns[fn], d2aFns[fn], `${fn}: B0 rollback is verbatim the current D2-A definition`);
}
assert.match(rollback, /drop function if exists private\.merchant_persistable_layouts\(\);/, "the B0 rollback drops the B0-only helper");
assert.doesNotMatch(rollback, /'profile\.name'|'presentation\.layout'|'tags\.cuisine'|'location'/, "the B0 rollback does not keep B0 Admin paths");
const b0Lock = b0Fns["private.lock_merchant_for_actor"];
assert.match(b0Lock, /if p_actor_type = 'owner' then[\s\S]*MERCHANT_SUSPENDED[\s\S]*'archived'/, "B0: Owner archived refusal kept");
assert.match(b0Lock, /if p_actor_type = 'admin' and \(m\.platform_restriction = 'archived' or m\.platform_status = 'ARCHIVED'\) then\s*perform private\.merchant_write_error\('OPERATION_FORBIDDEN', 'archived'\)/, "B0: Admin archived refusal kept");
const b0Noop = b0.slice(b0.indexOf("if cardinality(changed_paths) = 0 then"), b0.indexOf("if (select count(*) from unnest(changed_paths) p where p like 'hours.%')"));
assert.match(b0Noop, /for patch in select value from jsonb_array_elements\(p_patches\) loop[\s\S]*'values', values_out/, "B0: no-op confirms all requested snapshots");
assert.doesNotMatch(b0Noop, /update public\.merchants/, "B0: no-op does not update merchant rows");

console.log("merchant field patch checks passed");
