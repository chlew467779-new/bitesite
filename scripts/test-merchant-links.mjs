/**
 * Link review: URL rules (mirroring private.merchant_link_problem), request parsing, error mapping
 * and wiring guards. Database behaviour is tested by supabase/tests/links_review_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LINK_FIELDS, linkProblem, mapLinkRpcError, parseAdminLinkSet, parseLinkReview, parseOwnerLinkRequest } from "../lib/merchant-links-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a1";
const ID = "11111111-1111-4111-8111-111111111111";

assert.deepEqual(LINK_FIELDS.map((f) => f.field), ["website", "instagram", "facebook", "menu_pdf_url", "grabfood"]);
for (const [field, url, expected] of [
  ["website", "https://shop.example.com/a?b=1", null],
  ["website", "", null],
  ["website", "http://shop.example.com", "https_only"],
  ["website", "javascript:alert(1)", "https_only"],
  ["website", "https://user:pw@shop.example.com", "credentials"],
  ["website", "https://127.0.0.1/x", "host"],
  ["website", "https://localhost/x", "host"],
  ["website", "https://exa mple.com", "https_only"],
  ["website", `https://example.com/${"a".repeat(500)}`, "too_long"],
  ["instagram", "https://www.instagram.com/zz", null],
  ["instagram", "https://instagram.com.evil.io/zz", "host_instagram"],
  ["facebook", "https://m.facebook.com/zz", null],
  ["facebook", "https://facebook.co/zz", "host_facebook"],
  ["grabfood", "https://food.grab.com/my/en/restaurant/x", null],
  ["grabfood", "https://notgrab.com/x", "host_grabfood"],
]) assert.equal(linkProblem(field, url), expected, `${field} ${url.slice(0, 40)}`);

assert.deepEqual(parseOwnerLinkRequest({ requestId: REQ, action: "request", field: "website", url: " https://a.example.com " }),
  { ok: true, action: "request", requestId: REQ, field: "website", url: "https://a.example.com" });
assert.equal(parseOwnerLinkRequest({ requestId: REQ, action: "request", field: "website", url: null }).ok, true, "removal request");
assert.equal(parseOwnerLinkRequest({ requestId: REQ, action: "request", field: "website", url: "http://a.example.com" }).code, "INVALID_LINK");
assert.equal(parseOwnerLinkRequest({ requestId: REQ, action: "request", field: "logo", url: null }).ok, false);
assert.equal(parseOwnerLinkRequest({ requestId: REQ, action: "request", field: "website", url: null, merchantId: ID }).ok, false);
assert.equal(parseOwnerLinkRequest({ requestId: REQ, action: "withdraw", linkRequestId: ID }).ok, true);
assert.equal(parseAdminLinkSet({ requestId: REQ, field: "grabfood", url: "https://food.grab.com/x", expected: null }).ok, true);
assert.equal(parseLinkReview({ requestId: REQ, linkRequestId: ID, decision: "reject", note: " " }).ok, false, "reject needs a note");
assert.equal(parseLinkReview({ requestId: REQ, linkRequestId: ID, decision: "approve" }).ok, true);

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapLinkRpcError(rpc("INVALID_LINK", "host_instagram")).message, "Use an instagram.com link.");
assert.equal(mapLinkRpcError(rpc("LINK_CHANGED_SINCE_REQUEST")).status, 409);
assert.equal(mapLinkRpcError(rpc("MERCHANT_SUSPENDED")).status, 403);

const owner = await read("app/api/merchant/restaurants/[merchantId]/links/route.ts");
assert.match(owner, /requireMerchantUser\(request\)/);
assert.match(owner, /p_actor_type: 'owner', p_actor_id: auth\.user\.id/);
assert.doesNotMatch(owner, /merchant_link_admin_set|merchant_link_review/, "Owners cannot set or approve links");
for (const path of ["app/api/admin/merchants/[merchantId]/links/route.ts", "app/api/admin/link-reviews/route.ts"]) {
  assert.match(await read(path), /verifyAdminToken/, `${path}: Admin session`);
}
assert.match(await read("app/admin/components/admin-shell.tsx"), /id: 'link-reviews'/);
assert.match(await read("app/admin/page.tsx"), /<LinkReviewQueue searchQuery=\{changeRequestSearch\} \/>/);
assert.match(await read("app/admin/components/merchant-form.tsx"), /<MerchantLinksPanel /);
const requests = await read("app/merchant/components/link-requests.tsx");
assert.match(requests, /inputMode="url"/, "URL keyboard on phones");
assert.match(requests, /setUnknown\(pending\)/);
assert.match(await read("app/admin/components/link-review-queue.tsx"), /rel="noopener noreferrer nofollow"/, "requested links open safely");

const migration = await read("supabase/migrations/20260927120000_merchant_link_review.sql");
assert.doesNotMatch(migration, /security definer/i);
assert.match(migration, /private\.lock_merchant_for_actor\(p_actor_type, p_actor_id, p_merchant_id, true\)/);
assert.match(migration, /LINK_CHANGED_SINCE_REQUEST/);

console.log("merchant links checks passed");
