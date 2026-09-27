/**
 * M3a Owner menu: request shape, price input, error mapping and wiring guards.
 * Database behaviour is tested by supabase/tests/m3a_menu_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MENU_OP_TYPES, mapMenuRpcError, menuResponse, parseMenuRequest, parsePriceInput } from "../lib/merchant-menu-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2a3a1";

assert.equal(MENU_OP_TYPES.length, 9);
assert.equal(parseMenuRequest({ requestId: REQ, op: { type: "create_category", name: "Mains" } }).ok, true);
for (const [body, label] of [
  [{ requestId: "x", op: { type: "create_category" } }, "request id"],
  [{ requestId: REQ, op: { type: "drop_table" } }, "unknown op"],
  [{ requestId: REQ, op: [] }, "op array"],
  [{ requestId: REQ, op: { type: "create_category", merchantId: "x" } }, "merchant from the body"],
  [{ requestId: REQ, op: { type: "create_category" }, merchantId: "x" }, "extra top-level key"],
]) assert.equal(parseMenuRequest(body).ok, false, label);

assert.deepEqual(parsePriceInput(""), { ok: true, value: null }, "empty = no price");
assert.deepEqual(parsePriceInput("0"), { ok: true, value: 0 }, "0 is a real price");
assert.deepEqual(parsePriceInput("RM 12.5"), { ok: true, value: 12.5 });
for (const text of ["12.345", "-1", "abc", "1e3", "100001"]) assert.equal(parsePriceInput(text).ok, false, text);

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapMenuRpcError(rpc("PUBLIC_MENU_MINIMUM")).status, 422);
assert.match(mapMenuRpcError(rpc("VALIDATION_FAILED", "category_has_products")).message, /dishes/);
assert.equal(mapMenuRpcError(rpc("RESOURCE_NOT_FOUND", "category")).status, 409);
assert.equal(mapMenuRpcError(rpc("MERCHANT_SUSPENDED")).status, 403);
assert.equal(mapMenuRpcError({ code: "42501", message: "permission denied" }).status, 500);
assert.equal(menuResponse({ status: "conflict", menu: { categories: [], products: [] } }, REQ).status, 409);
assert.deepEqual(menuResponse({ status: "applied", type: "create_category", id: "x", menu: { categories: [], products: [] } }, REQ).body.menu, { categories: [], products: [] });

const route = await read("app/api/merchant/restaurants/[merchantId]/menu/route.ts");
assert.match(route, /requireMerchantUser\(request\)/, "verified Owner");
assert.match(route, /p_actor_type: 'owner',\s*p_actor_id: auth\.user\.id/, "actor is server-built");
assert.doesNotMatch(route, /\.from\('(products|categories)'\)/, "no direct menu table writes or reads in the route");
const manager = await read("app/merchant/components/menu-manager.tsx");
assert.match(manager, /type: 'update_product', id: product\.id, changes: \{ isAvailable: !product\.isAvailable \}, expected: \{ isAvailable: product\.isAvailable \}/, "sold-out toggle uses compare-and-set");
assert.match(manager, /setUnknown\(pending\)/, "unknown results keep the request for a safe retry");
assert.match(manager, /min-h-11/, "touch-sized buttons");
assert.match(manager, /inputMode="decimal"/, "numeric keyboard for prices on phones");
assert.match(await read("app/merchant/page.tsx"), /<MenuManager /, "the dashboard shows the menu manager");

const migration = await read("supabase/migrations/20260927110000_merchant_menu.sql");
for (const fn of ["merchant_menu_read", "merchant_menu_apply"]) {
  const body = migration.slice(migration.indexOf(`function public.${fn}(`));
  assert.match(body.slice(0, body.indexOf("as $$")), /security invoker\s+set search_path = ''/, `${fn}: invoker`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`), `${fn}: service_role only`);
}
assert.match(migration, /private\.lock_merchant_for_actor\(p_actor_type, p_actor_id, p_merchant_id, true\)/);
assert.doesNotMatch(migration, /security definer/i);

console.log("merchant menu checks passed");
