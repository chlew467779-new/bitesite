/**
 * M6b trusted profile images: request parsing, file-type sniffing, error mapping and wiring guards.
 * Database behaviour is tested by supabase/tests/m6b_profile_media_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MEDIA_MAX_BYTES,
  mapMediaRpcError,
  mediaBindResponse,
  mediaObjectPath,
  parseBindRequest,
  parseTicketRequest,
  sniffImageType,
} from "../lib/merchant-media-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2b601";
const UP = "11111111-1111-4111-8111-111111111111";

/* ── parsing ─────────────────────────────────────────────────────────────────────────────── */

assert.deepEqual(parseTicketRequest({ slot: "logo", contentType: "image/webp", size: 1000 }), { ok: true, slot: "logo", contentType: "image/webp" });
for (const [body, label] of [
  [{ slot: "banner", contentType: "image/webp", size: 1 }, "slot"],
  [{ slot: "logo", contentType: "image/gif", size: 1 }, "type"],
  [{ slot: "logo", contentType: "image/webp", size: 0 }, "empty"],
  [{ slot: "logo", contentType: "image/webp", size: MEDIA_MAX_BYTES + 1 }, "too large"],
  [{ slot: "logo", contentType: "image/webp", size: 1, path: "x" }, "client path"],
  [{ slot: "logo", contentType: "image/webp", size: 1, merchantId: "x" }, "client merchant"],
]) assert.equal(parseTicketRequest(body).ok, false, label);
assert.equal(parseTicketRequest({ slot: "logo", contentType: "image/webp", size: MEDIA_MAX_BYTES + 1 }).status, 413);

assert.deepEqual(parseBindRequest({ requestId: REQ, slot: "cover", uploadId: UP, expected: null }), { ok: true, requestId: REQ, slot: "cover", uploadId: UP, expected: null });
assert.equal(parseBindRequest({ requestId: REQ, slot: "cover", uploadId: null, expected: "https://x/y.webp" }).ok, true, "remove");
for (const [body, label] of [
  [{ requestId: "x", slot: "cover", uploadId: null, expected: null }, "request id"],
  [{ requestId: REQ, slot: "cover", uploadId: "x", expected: null }, "upload id"],
  [{ requestId: REQ, slot: "cover", uploadId: null, expected: 5 }, "expected type"],
  [{ requestId: REQ, slot: "cover", uploadId: UP, expected: null, url: "https://evil" }, "client URL"],
]) assert.equal(parseBindRequest(body).ok, false, label);

/* ── real file type ──────────────────────────────────────────────────────────────────────── */

assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
assert.equal(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])), "image/webp");
assert.equal(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null, "SVG/HTML is not an image here");
assert.equal(sniffImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38])), null, "GIF refused");
assert.equal(sniffImageType(null), null);
assert.equal(mediaObjectPath("abc", "logo", "image/webp", UP), `profile/abc/logo/${UP}.webp`);

/* ── errors and responses ────────────────────────────────────────────────────────────────── */

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapMediaRpcError(rpc("RATE_LIMITED")).status, 429);
assert.equal(mapMediaRpcError(rpc("VALIDATION_FAILED", "upload_used")).status, 409);
assert.equal(mapMediaRpcError(rpc("RESOURCE_NOT_FOUND", "upload")).status, 409);
assert.equal(mapMediaRpcError(rpc("MERCHANT_SUSPENDED")).status, 403, "shared field codes still map");
assert.equal(mapMediaRpcError({ code: "42501", message: "permission denied" }).status, 500);
assert.equal(mediaBindResponse({ status: "conflict", current: "https://a" }, REQ).status, 409);
assert.equal(mediaBindResponse({ status: "applied", slot: "logo", value: "https://a" }, REQ).body.data.value, "https://a");

/* ── wiring (source level) ───────────────────────────────────────────────────────────────── */

const lib = await read("app/api/_lib/merchant-media.ts");
assert.match(lib, /mediaObjectPath\(merchantId\.toLowerCase\(\), parsed\.slot/, "the server chooses the object path");
assert.match(lib, /sniffImageType\(bytes\) !== upload\.content_type/, "the stored bytes are checked before binding");
assert.match(lib, /getPublicUrl\(upload\.path\)/, "the public URL comes from the ticket, not the body");
assert.ok(lib.indexOf("merchant_media_read") < lib.indexOf(".download("), "access is screened before any download");
assert.doesNotMatch(lib, /\.from\('merchants'\)\.update|\.update\(/, "no direct merchant UPDATE");
for (const path of [
  "app/api/admin/merchants/[merchantId]/media/route.ts",
  "app/api/admin/merchants/[merchantId]/media/ticket/route.ts",
]) assert.match(await read(path), /verifyAdminToken/, `${path}: Admin session`);
for (const path of [
  "app/api/merchant/restaurants/[merchantId]/media/route.ts",
  "app/api/merchant/restaurants/[merchantId]/media/ticket/route.ts",
]) assert.match(await read(path), /requireMerchantUser\(request\)/, `${path}: verified Owner`);

const field = await read("app/components/media/profile-image-field.tsx");
assert.match(field, /accept="image\/jpeg,image\/png,image\/webp"/, "phones convert HEIC for these types");
assert.match(field, /fileType: 'image\/webp'/, "resized to WebP on the device");
assert.match(field, /setUnknown\(pending\)/, "an unconfirmed bind keeps its request for a safe retry");
assert.match(field, /min-h-11/, "touch-sized buttons");
assert.match(await read("app/admin/components/merchant-form.tsx"), /<ProfileImagesPanel /, "Admin editor uses the photo panel");
assert.match(await read("app/merchant/page.tsx"), /<ProfileImagesPanel /, "Merchant dashboard uses the photo panel");

const migration = await read("supabase/migrations/20260927100000_merchant_profile_media.sql");
for (const fn of ["merchant_media_ticket", "merchant_media_bind", "merchant_media_read"]) {
  const body = migration.slice(migration.indexOf(`function public.${fn}(`));
  assert.match(body.slice(0, body.indexOf("as $$")), /security invoker\s+set search_path = ''/, `${fn}: invoker`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`), `${fn}: service_role only`);
}
assert.match(migration, /private\.lock_merchant_for_actor\(p_actor_type, p_actor_id, p_merchant_id, true\)/, "same authorization and state checks as field saves");
assert.doesNotMatch(migration, /security definer/i);

console.log("merchant media checks passed");
