/**
 * Restaurant web address rename: slug rules, request parsing, error mapping and wiring guards.
 * Database behaviour is tested by supabase/tests/slug_history_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isValidSlug, mapSlugRpcError, normalizeSlug, parseSlugChange } from "../lib/merchant-slug-core.mjs";
import { formatPrice } from "../lib/price-format.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a1";

for (const [value, ok] of [
  ["kedai-kopi", true], ["a1", true], ["x", false], ["Kedai", false], ["kedai--kopi", false], ["-kedai", false],
  ["kedai-", false], ["kedai kopi", false], ["kedai_kopi", false], ["a".repeat(64), true], ["a".repeat(65), false],
]) assert.equal(isValidSlug(value), ok, value);
assert.equal(normalizeSlug("  Kedai-Kopi "), "kedai-kopi");

assert.deepEqual(parseSlugChange({ requestId: REQ, slug: " Kedai-Kopi ", expected: "old" }), { ok: true, requestId: REQ, slug: "kedai-kopi", expected: "old" });
assert.equal(parseSlugChange({ requestId: REQ, slug: "kedai kopi", expected: "old" }).ok, false);
assert.equal(parseSlugChange({ requestId: REQ, slug: "kedai", expected: "old", merchantId: "x" }).ok, false, "no extra keys");
assert.equal(parseSlugChange({ requestId: "nope", slug: "kedai", expected: "old" }).ok, false);
assert.equal(parseSlugChange({ requestId: REQ, slug: "kedai" }).ok, false, "expected is required");

assert.equal(mapSlugRpcError({ code: "23505", message: "SLUG_TAKEN", details: "history" }).status, 409);
assert.equal(mapSlugRpcError({ code: "P0001", message: "SLUG_TAKEN" }).code, "SLUG_TAKEN");
assert.equal(mapSlugRpcError({ code: "P0001", message: "VALIDATION_FAILED", details: "slug_format" }).status, 400);
assert.equal(mapSlugRpcError({ code: "P0001", message: "OPERATION_FORBIDDEN", details: "archived" }).status, 403);

assert.equal(formatPrice(2.5), "RM 2.50");
assert.equal(formatPrice("12"), "RM 12.00");
assert.equal(formatPrice(0), "RM 0.00", "0 is a real price");
assert.equal(formatPrice(null), "");

const route = await read("app/api/admin/merchants/[merchantId]/slug/route.ts");
assert.match(route, /verifyAdminToken/, "Admin session");
assert.match(route, /p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL/);
assert.match(route, /revalidatePath\(`\/store\/\$\{result\.previousSlug\}`\)/, "old address refreshed so it redirects");
const page = await read("app/store/[merchant]/page.tsx");
assert.match(page, /getRenamedMerchantSlug\(slug\)/);
assert.match(page, /permanentRedirect\(/, "old addresses redirect permanently");
assert.match(await read("app/admin/components/merchant-form.tsx"), /<MerchantSlugPanel /);
for (const layout of ["chinese", "classic", "elegant", "malay", "minimal", "modern", "rustic"]) {
  assert.doesNotMatch(await read(`app/layouts/${layout}-layout.tsx`), /RM \{product\.|`RM \$\{product\./, `${layout}: prices use formatPrice`);
}

const migration = await read("supabase/migrations/20260927140000_merchant_slug_history.sql");
assert.doesNotMatch(migration.replace(/private\.merchant_id_is_public/g, ""), /security definer/i, "no new definer functions");
assert.match(migration, /on update cascade on delete set null/);
assert.match(migration, /errcode = '23505', message = 'SLUG_TAKEN'/);
const rollback = await read("supabase/rollback/20260927140000_merchant_slug_history.rollback.STAGING_ONLY.sql");
assert.match(rollback, /if 'NO' <> 'yes'/, "rollback is switched off by default");

console.log("merchant slug checks passed");
