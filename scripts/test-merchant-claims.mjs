/**
 * Merchant claims: form checks, request parsing, error mapping, the post-sign-in redirect guard
 * and wiring. Database behaviour is tested by supabase/tests/merchant_claims_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { claimFormProblems, isClaimSlug, mapClaimRpcError, parseClaimDecision, parseClaimRequest, safeMerchantNext } from "../lib/merchant-claim-core.mjs";
import { notificationEmail } from "../lib/notification-content.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a1";
const ID = "11111111-1111-4111-8111-111111111111";
const good = { relationship: "owner", contactName: " Ah Seng ", contactPhone: "+60 12-345 6789", evidence: "SSM 202301234567" };

assert.deepEqual(claimFormProblems(good), {});
assert.ok(claimFormProblems({ ...good, relationship: "" }).relationship);
assert.ok(claimFormProblems({ ...good, contactPhone: "call me" }).contactPhone);
assert.ok(claimFormProblems({ ...good, evidence: "trust me" }).evidence, "evidence needs 10 characters");
assert.equal(isClaimSlug("kopi-ah-seng"), true);
assert.equal(isClaimSlug("../admin"), false);

assert.deepEqual(parseClaimRequest({ requestId: REQ, action: "submit", ...good }),
  { ok: true, action: "submit", requestId: REQ, relationship: "owner", contactName: "Ah Seng", contactPhone: "+60 12-345 6789", evidence: "SSM 202301234567" });
assert.equal(parseClaimRequest({ requestId: REQ, action: "submit", ...good, merchantId: ID }).ok, false, "no restaurant in the body");
assert.equal(parseClaimRequest({ requestId: REQ, action: "withdraw", claimId: ID }).ok, true);
assert.equal(parseClaimRequest({ requestId: REQ, action: "approve", claimId: ID }).ok, false);
assert.equal(parseClaimDecision({ requestId: REQ, claimId: ID, decision: "reject", note: " " }).ok, false, "reject needs a note");
assert.equal(parseClaimDecision({ requestId: REQ, claimId: ID, decision: "approve" }).ok, true);

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapClaimRpcError(rpc("CLAIM_NOT_AVAILABLE", "managed")).status, 409);
assert.match(mapClaimRpcError(rpc("CLAIM_NOT_AVAILABLE", "managed")).message, /already managed/);
assert.equal(mapClaimRpcError(rpc("CLAIM_ONE_PENDING")).status, 409);
assert.equal(mapClaimRpcError(rpc("CLAIM_OWNER_EXISTS")).status, 409);
assert.equal(mapClaimRpcError(rpc("RESOURCE_NOT_FOUND")).status, 404);

// Only same-site Merchant paths survive sign-in.
assert.equal(safeMerchantNext("/merchant/claim?restaurant=kopi"), "/merchant/claim?restaurant=kopi");
for (const bad of ["https://evil.example", "//evil.example", "/admin", "/merchantx", "/merchant\\..", null, "/merchant/claim ok"]) {
  assert.equal(safeMerchantNext(bad), "/merchant", String(bad));
}

assert.match(notificationEmail({ kind: "claim_submitted", audience: "admin", merchantId: ID, merchantName: "Kopi" }, "https://x.my").text, /Restaurant Claims/);
assert.match(notificationEmail({ kind: "claim_rejected", audience: "owner", merchantId: ID, merchantName: "Kopi", message: "No proof" }, "https://x.my").text, /\/merchant\/claim/);

const route = await read("app/api/merchant/claims/route.ts");
assert.match(route, /requireMerchantUser\(request\)/);
assert.match(route, /email_confirmed_at/, "confirmed email required to claim");
assert.match(route, /searchParams\.get\('slug'\)/, "the restaurant comes from the URL");
assert.doesNotMatch(route, /merchant_claim_decide|merchant_claim_queue/, "claimants cannot decide");
const admin = await read("app/api/admin/claims/route.ts");
assert.match(admin, /verifyAdminToken/);
assert.match(await read("app/admin/components/admin-shell.tsx"), /id: 'claims'/);
assert.match(await read("app/admin/page.tsx"), /<ClaimQueue \/>/);
assert.match(await read("app/api/admin/attention/route.ts"), /count\('merchant_claims'\)/);
assert.match(await read("app/store/[merchant]/page.tsx"), /\/merchant\/claim\?restaurant=/, "store page links to the claim page");
assert.match(await read("app/merchant/login/page.tsx"), /safeMerchantNext\(/, "login returns only to safe paths");

console.log("merchant claim checks passed");
