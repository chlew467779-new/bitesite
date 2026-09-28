/**
 * Dish photos: request parsing, object paths, error mapping and wiring guards.
 * Database behaviour is tested by supabase/tests/dish_media_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DISH_RESIZE, dishObjectPath, mapDishMediaRpcError, parseDishBindRequest, parseDishTicketRequest } from "../lib/merchant-media-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a1";
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const UPLOAD = "22222222-2222-4222-8222-222222222222";

assert.deepEqual(parseDishTicketRequest({ productId: PRODUCT.toUpperCase(), contentType: "image/webp", size: 1000 }), { ok: true, productId: PRODUCT, contentType: "image/webp" });
assert.equal(parseDishTicketRequest({ productId: PRODUCT, contentType: "image/gif", size: 1000 }).ok, false);
assert.equal(parseDishTicketRequest({ productId: PRODUCT, contentType: "image/webp", size: 6 * 1024 * 1024 }).status, 413);
assert.equal(parseDishTicketRequest({ productId: PRODUCT, contentType: "image/webp", size: 1000, path: "x" }).ok, false, "the client never picks the path");
assert.equal(parseDishTicketRequest({ slot: "logo", contentType: "image/webp", size: 1000 }).ok, false);
assert.equal(parseDishBindRequest({ requestId: REQ, productId: PRODUCT, uploadId: UPLOAD, expected: null }).ok, true);
assert.equal(parseDishBindRequest({ requestId: REQ, productId: PRODUCT, uploadId: null, expected: "https://x/y.webp" }).ok, true, "remove");
assert.equal(parseDishBindRequest({ requestId: REQ, productId: PRODUCT, uploadId: UPLOAD, expected: null, url: "https://evil" }).ok, false, "no client URL");
assert.equal(dishObjectPath("m", "p", "image/webp", "u"), "dish/m/p/u.webp");
assert.ok(DISH_RESIZE.maxWidthOrHeight >= 800 && DISH_RESIZE.maxWidthOrHeight <= 1600);

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapDishMediaRpcError(rpc("RESOURCE_NOT_FOUND", "product")).status, 409);
assert.equal(mapDishMediaRpcError(rpc("RATE_LIMITED")).status, 429);
assert.equal(mapDishMediaRpcError(rpc("VALIDATION_FAILED", "upload_used")).status, 409);
assert.equal(mapDishMediaRpcError(rpc("MERCHANT_SUSPENDED")).status, 403);

const lib = await read("app/api/_lib/merchant-media.ts");
assert.match(lib, /supabase\.rpc\('merchant_dish_media_ticket'/);
assert.match(lib, /supabase\.rpc\('merchant_dish_media_bind'/);
assert.match(lib, /upload\.product_id !== parsed\.productId/, "a ticket binds only to its own dish");
assert.match(lib, /sniffImageType\(bytes\) !== upload\.content_type/, "stored bytes are checked before binding");
for (const path of ["app/api/merchant/restaurants/[merchantId]/menu/dish-photo/route.ts", "app/api/merchant/restaurants/[merchantId]/menu/dish-photo/ticket/route.ts"]) {
  const route = await read(path);
  assert.match(route, /requireMerchantUser\(request\)/, `${path}: verified Owner`);
  assert.match(route, /type: 'owner', userId: auth\.user\.id/, `${path}: actor from the session only`);
}
const manager = await read("app/merchant/components/menu-manager.tsx");
assert.match(manager, /slot="dish"/);
assert.match(manager, /apiBase=\{`\$\{api\}\/dish-photo`\}/);

const migration = await read("supabase/migrations/20260927150000_merchant_dish_media.sql");
assert.doesNotMatch(migration, /security definer/i);
assert.match(migration, /u\.slot in \('logo', 'cover'\)/, "logo/cover limit ignores dish tickets");
assert.match(await read("supabase/rollback/20260927150000_merchant_dish_media.rollback.STAGING_ONLY.sql"), /if 'NO' <> 'yes'/);

console.log("dish media checks passed");
