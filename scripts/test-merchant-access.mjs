/**
 * M1-A explicit merchant context: behaviour of the shared access decision
 * (lib/merchant-access-core.mjs), the browser URL helpers (lib/merchant-context-url.mjs), and
 * source wiring guards for every merchant API route and page.
 *
 * Behaviour tests run the real decision code with the memberships each account would load.
 * The routes talk to Supabase and are checked here at source level only; no database is used
 * (see the package report for what still needs a local-database run).
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  MERCHANT_ACCESS_COLUMNS,
  merchantRestriction,
  merchantSummary,
  readRequestedMerchantId,
  resolveMerchantAccess,
} from "../lib/merchant-access-core.mjs";
import { merchantApiUrl, merchantPageUrl, selectedMerchantIdFromSearch } from "../lib/merchant-context-url.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const row = (id, name, extra = {}) => ({
  id, name, slug: name.toLowerCase().replace(/\s+/g, "-"), business_status: "OPEN",
  platform_status: "PUBLISHED", platform_restriction: "none", ...extra,
});

const A = row("11111111-1111-4111-8111-111111111111", "Alpha Kitchen");
const B = row("22222222-2222-4222-8222-222222222222", "Beta Bakery");
const C = row("33333333-3333-4333-8333-333333333333", "Gamma Grill");
const SUSPENDED_LEGACY = row("44444444-4444-4444-8444-444444444444", "Delta Diner", { platform_status: "SUSPENDED" });
const SUSPENDED_MANAGED = row("55555555-5555-4555-8555-555555555555", "Echo Eatery", { platform_status: "SUSPENDED", platform_restriction: "suspended" });
const ARCHIVED = row("66666666-6666-4666-8666-666666666666", "Foxtrot Food", { platform_status: "ARCHIVED" });

// What each account's own active Owner memberships return.
const accounts = {
  ownerA: [A],
  ownerB: [B],
  noMembership: [],
  multiOwner: [A, C],
  suspendedOwner: [SUSPENDED_LEGACY],
  suspendedManagedOwner: [SUSPENDED_MANAGED],
  archivedOwner: [ARCHIVED],
};

const access = (account, requestedMerchantId, capability) =>
  resolveMerchantAccess({ merchants: accounts[account], requestedMerchantId, capability });
const expectDenied = (result, status, code, label) => {
  assert.equal(result.ok, false, `${label}: denied`);
  assert.equal(result.status, status, `${label}: status ${status}`);
  assert.equal(result.code, code, `${label}: ${code}`);
  assert.ok(!("merchant" in result), `${label}: no merchant data in a denial`);
};

/* ── Owner A / Owner B ─────────────────────────────────────────────────────────────────────── */

for (const capability of ["read", "write"]) {
  const own = access("ownerA", A.id, capability);
  assert.equal(own.ok, true, `Owner A ${capability}s own merchant by ID`);
  assert.equal(own.merchant.id, A.id);

  const implicit = access("ownerA", undefined, capability);
  assert.equal(implicit.ok, true, `Owner A with one merchant needs no ID (${capability})`);
  assert.equal(implicit.merchant.id, A.id);

  expectDenied(access("ownerA", B.id, capability), 404, "RESOURCE_NOT_FOUND", `Owner A → Owner B's merchant (${capability})`);
  expectDenied(access("ownerB", A.id, capability), 404, "RESOURCE_NOT_FOUND", `Owner B → Owner A's merchant (${capability})`);
  expectDenied(access("ownerA", C.id, capability), 404, "RESOURCE_NOT_FOUND", `Owner A → someone else's merchant (${capability})`);
}
assert.equal(access("ownerA", A.id.toUpperCase(), "write").merchant.id, A.id, "IDs compare case-insensitively");

/* ── malformed IDs are 404, not "absent" ───────────────────────────────────────────────────── */

for (const bad of ["not-a-uuid", "1", `${A.id} `, `${A.id}x`, "' or 1=1 --", "__proto__"]) {
  expectDenied(access("ownerA", bad, "read"), 404, "RESOURCE_NOT_FOUND", `malformed ID ${JSON.stringify(bad)}`);
}

/* ── no membership ─────────────────────────────────────────────────────────────────────────── */

expectDenied(access("noMembership", undefined, "read"), 404, "RESOURCE_NOT_FOUND", "no membership, no ID");
expectDenied(access("noMembership", A.id, "write"), 404, "RESOURCE_NOT_FOUND", "no membership, someone's ID");

/* ── several merchants need an explicit ID ─────────────────────────────────────────────────── */

for (const capability of ["read", "write"]) {
  expectDenied(access("multiOwner", undefined, capability), 409, "MERCHANT_CONTEXT_REQUIRED", `multi-owner without ID (${capability})`);
}
assert.equal(access("multiOwner", C.id, "write").merchant.id, C.id, "multi-owner selects C");
assert.equal(access("multiOwner", A.id, "write").merchant.id, A.id, "multi-owner selects A");
expectDenied(access("multiOwner", B.id, "write"), 404, "RESOURCE_NOT_FOUND", "multi-owner → a merchant they do not own");

/* ── suspended / archived: readable, not writable ──────────────────────────────────────────── */

for (const [account, merchant, restriction, code] of [
  ["suspendedOwner", SUSPENDED_LEGACY, "suspended", "MERCHANT_SUSPENDED"],
  ["suspendedManagedOwner", SUSPENDED_MANAGED, "suspended", "MERCHANT_SUSPENDED"],
  ["archivedOwner", ARCHIVED, "archived", "OPERATION_FORBIDDEN"],
]) {
  const readResult = access(account, merchant.id, "read");
  assert.equal(readResult.ok, true, `${account} can read`);
  assert.equal(readResult.restriction, restriction);
  expectDenied(access(account, merchant.id, "write"), 403, code, `${account} write by ID`);
  expectDenied(access(account, undefined, "write"), 403, code, `${account} write without ID`);
  // Another account asking for the suspended merchant still gets 404, not 403.
  expectDenied(access("ownerA", merchant.id, "write"), 404, "RESOURCE_NOT_FOUND", `foreign ${restriction} merchant stays hidden`);
}

assert.equal(merchantRestriction({ platform_status: "PUBLISHED", platform_restriction: "none" }), "none");
assert.equal(merchantRestriction({ platform_status: null, platform_restriction: null }), "none");
assert.equal(merchantRestriction({ platform_status: "DRAFT", platform_restriction: "suspended" }), "suspended");

/* ── input parsing, summaries, URLs ────────────────────────────────────────────────────────── */

assert.equal(readRequestedMerchantId(null), undefined);
assert.equal(readRequestedMerchantId(""), undefined);
assert.equal(readRequestedMerchantId("   "), undefined);
assert.equal(readRequestedMerchantId(` ${A.id} `), A.id);

assert.deepEqual(Object.keys(merchantSummary(A)).sort(), ["business_status", "id", "name", "restriction", "slug"],
  "summaries carry no private or state-internal columns");
for (const column of MERCHANT_ACCESS_COLUMNS) assert.ok(!["email", "phone", "reviews", "settings"].includes(column));

assert.equal(selectedMerchantIdFromSearch(`?merchant=${A.id}`), A.id);
assert.equal(selectedMerchantIdFromSearch("?merchant="), null);
assert.equal(selectedMerchantIdFromSearch(""), null);
assert.equal(merchantApiUrl("/api/merchant/me", null), "/api/merchant/me");
assert.equal(merchantApiUrl("/api/merchant/me", A.id), `/api/merchant/me?merchantId=${A.id}`);
assert.equal(merchantApiUrl("/api/x?kind=1", "a&b=c"), "/api/x?kind=1&merchantId=a%26b%3Dc", "IDs are encoded");
assert.equal(merchantPageUrl("/merchant/stories", A.id), `/merchant/stories?merchant=${A.id}`);

/* ── route wiring (source level) ───────────────────────────────────────────────────────────── */

async function listRoutes(dir) {
  const out = [];
  for (const entry of await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await listRoutes(rel)));
    else if (entry.name === "route.ts") out.push(rel);
  }
  return out;
}

const merchantRoutes = await listRoutes("app/api/merchant");
assert.deepEqual(merchantRoutes.sort(), [
  "app/api/merchant/me/route.ts",
  "app/api/merchant/media/upload-url/route.ts",
  "app/api/merchant/profile-change-requests/route.ts",
  "app/api/merchant/restaurants/[merchantId]/basics/route.ts",
  "app/api/merchant/restaurants/[merchantId]/business-status/route.ts",
  "app/api/merchant/restaurants/[merchantId]/feedback/route.ts",
  "app/api/merchant/restaurants/[merchantId]/fields/route.ts",
  "app/api/merchant/restaurants/[merchantId]/links/route.ts",
  "app/api/merchant/restaurants/[merchantId]/listing/route.ts",
  "app/api/merchant/restaurants/[merchantId]/media/route.ts",
  "app/api/merchant/restaurants/[merchantId]/media/ticket/route.ts",
  "app/api/merchant/restaurants/[merchantId]/menu/dish-photo/route.ts",
  "app/api/merchant/restaurants/[merchantId]/menu/dish-photo/ticket/route.ts",
  "app/api/merchant/restaurants/[merchantId]/menu/route.ts",
  "app/api/merchant/preview/route.ts",
  "app/api/merchant/restaurants/[merchantId]/stats/route.ts",
  "app/api/merchant/restaurants/route.ts",
  "app/api/merchant/story-submissions/route.ts",
].sort(), "the merchant route list is known; a new route must be added to these checks");

for (const path of merchantRoutes) {
  const source = await read(path);
  assert.doesNotMatch(source, /\.limit\(1\)/, `${path}: no first-membership selection`);
  assert.doesNotMatch(source, /from\('merchant_memberships'\)/, `${path}: memberships are only read by the shared helper`);
  assert.doesNotMatch(source, /auth\.getUser\(/, `${path}: authentication goes through the shared helper`);
  assert.doesNotMatch(source, /body\.(merchant_id|merchantId|merchant_slug|slug|user_id|userId)\b/, `${path}: merchant and user never come from the body`);
  assert.doesNotMatch(source, /merchants\(\*\)|select\('\*'\)|from\('merchants'\)[^;]*\.select\(\)/, `${path}: no whole-row merchant reads`);
  assert.match(source, /from '@\/app\/api\/merchant\/_lib\/merchant-access'/, `${path}: uses the shared access helper`);
}

const me = await read("app/api/merchant/me/route.ts");
const meGet = me.slice(me.indexOf("export async function GET"), me.indexOf("export async function PUT"));
const mePut = me.slice(me.indexOf("export async function PUT"));
assert.match(meGet, /requireMerchantUser\(request\)/);
assert.match(meGet, /loadOwnedMerchants\(auth\.user\.id\)/);
assert.match(meGet, /capability: 'read'/, "the profile read uses read capability");
assert.match(meGet, /merchants, merchant: null/, "no or several merchants: a list, no default target");
// D2-B: the old whole-form save is retired; it still authenticates and scopes, then refuses.
assert.match(mePut, /requireMerchantAccess\(request, 'read'\)/, "retired PUT still resolves access first");
assert.match(mePut, /410, 'LEGACY_WRITE_RETIRED'/, "…and writes nothing");
assert.doesNotMatch(me, /\.update\(/, "no merchant UPDATE remains in /me");

const expectCapability = { "app/api/merchant/media/upload-url/route.ts": ["write"], "app/api/merchant/profile-change-requests/route.ts": ["read", "write"], "app/api/merchant/story-submissions/route.ts": ["read", "write"] };
for (const [path, capabilities] of Object.entries(expectCapability)) {
  const source = await read(path);
  for (const capability of capabilities) assert.match(source, new RegExp(`requireMerchantAccess\\(request, '${capability}'\\)`), `${path}: ${capability} access`);
}
const stories = await read("app/api/merchant/story-submissions/route.ts");
// D2-A: the POST slug is set by merchant_story_submission_create from the locked restaurant.
assert.match(stories, /p_merchant_id: context\.merchant\.id/, "Story submissions name the verified restaurant");
assert.match(stories, /\.eq\('merchant_id', context\.merchant\.id\)/, "the Story list is scoped by the verified restaurant id");

const helper = await read("app/api/merchant/_lib/merchant-access.ts");
assert.match(helper, /^import 'server-only';/m, "the helper is server-only");
assert.match(helper, /supabase\.auth\.getUser\(token\)/, "the user is verified with getUser");
assert.doesNotMatch(helper, /getSession|user_metadata|app_metadata/, "no session object or metadata role is trusted");
assert.match(helper, /\.eq\('user_id', userId\)\s*\.eq\('status', 'active'\)\s*\.eq\('role', 'owner'\)/, "only the caller's active Owner memberships");
assert.doesNotMatch(helper, /\.limit\(/, "all memberships are loaded; none is chosen implicitly");
assert.match(helper, /searchParams\.get\('merchantId'\)/, "the merchant ID is an explicit request parameter");

/* ── pages always name the restaurant ─────────────────────────────────────────────────────── */

// Merchant API calls either name the restaurant with merchantApiUrl (?merchantId=), carry it in the
// path (/api/merchant/restaurants/<id>/...), or are the account bootstrap /api/merchant/me.
for (const path of ["app/merchant/page.tsx", "app/merchant/stories/page.tsx"]) {
  const source = await read(path);
  const calls = [...source.matchAll(/fetch\(\s*(['"`])(\/api\/merchant\/[^'"`?]*)/g)].map((m) => m[2]);
  for (const call of calls) {
    assert.ok(call === "/api/merchant/me" || call.startsWith("/api/merchant/restaurants/${"), `${path}: ${call} must name the restaurant`);
  }
  assert.match(source, /from '@\/lib\/merchant-context-url\.mjs'/, `${path}: uses the shared URL helper`);
}
const dashboard = await read("app/merchant/page.tsx");
assert.match(dashboard, /selected \? `\/api\/merchant\/me\?merchantId=\$\{encodeURIComponent\(selected\)\}`/, "the bootstrap names the selected restaurant");
assert.match(dashboard, /fetch\(`\/api\/merchant\/restaurants\/\$\{encodeURIComponent\(current\.profile\.id\)\}\/fields`/, "saves target the loaded restaurant by id");
assert.match(dashboard, /session\.session\.user\.id !== current\.userId/, "a save is refused if the signed-in account changed");
assert.match(dashboard, /kind: 'no-merchant'/, "an account without restaurants gets an explicit state");
assert.match(dashboard, /kind: 'choose'/, "several restaurants: the Owner chooses");
assert.match(dashboard, /readOnly=\{props\.readOnly\}/, "suspended/archived restaurants cannot be saved from the page");
const storiesPage = await read("app/merchant/stories/page.tsx");
assert.match(storiesPage, /bitesite:merchant-story-draft:\$\{userId\}:\$\{currentMerchantId\}/, "Story drafts are kept per restaurant");

console.log("merchant access checks passed");
