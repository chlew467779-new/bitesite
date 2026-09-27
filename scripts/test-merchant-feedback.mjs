/**
 * Merchant feedback: request parsing, error mapping and wiring guards.
 * Database behaviour is tested by supabase/tests/feedback_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FEEDBACK_TOPICS, mapFeedbackRpcError, parseFeedbackSubmit, parseFeedbackUpdate } from "../lib/merchant-feedback-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a1";

assert.deepEqual(FEEDBACK_TOPICS.map((t) => t.value), ["suggestion", "problem", "listing"], "topics match the database check");
assert.deepEqual(parseFeedbackSubmit({ requestId: REQ, topic: "problem", message: "  Menu broken  " }), { ok: true, requestId: REQ, topic: "problem", message: "Menu broken" });
assert.equal(parseFeedbackSubmit({ requestId: REQ, topic: "problem", message: "   " }).ok, false);
assert.equal(parseFeedbackSubmit({ requestId: REQ, topic: "other", message: "x" }).ok, false);
assert.equal(parseFeedbackSubmit({ requestId: REQ, topic: "problem", message: "x".repeat(2001) }).ok, false);
assert.equal(parseFeedbackSubmit({ requestId: REQ, topic: "problem", message: "x", merchantId: "y" }).ok, false, "no extra keys");
assert.deepEqual(parseFeedbackUpdate({ id: REQ, status: "resolved", reply: " Thanks " }), { ok: true, id: REQ, status: "resolved", reply: "Thanks" });
assert.equal(parseFeedbackUpdate({ id: REQ, status: "closed" }).ok, false);
assert.equal(mapFeedbackRpcError({ code: "P0001", message: "RATE_LIMITED" }).status, 429);
assert.equal(mapFeedbackRpcError({ code: "P0001", message: "RESOURCE_NOT_FOUND", details: "feedback" }).status, 404);

const owner = await read("app/api/merchant/restaurants/[merchantId]/feedback/route.ts");
assert.match(owner, /requireMerchantUser\(request\)/);
assert.match(owner, /p_actor_type: 'owner', p_actor_id: auth\.user\.id/);
assert.doesNotMatch(owner, /merchant_feedback_update|merchant_feedback_queue/, "Owners cannot read the inbox or change status");
assert.match(await read("app/api/admin/feedback/route.ts"), /verifyAdminToken/);
assert.match(await read("app/admin/components/admin-shell.tsx"), /id: 'feedback'/);
assert.match(await read("app/admin/page.tsx"), /<FeedbackInbox \/>/);
const migration = await read("supabase/migrations/20260927160000_merchant_feedback.sql");
assert.doesNotMatch(migration, /security definer/i);
assert.match(migration, /private\.lock_merchant_for_actor\(p_actor_type, p_actor_id, p_merchant_id, false\)/, "suspended Owners can still send feedback");
assert.match(await read("supabase/rollback/20260927160000_merchant_feedback.rollback.STAGING_ONLY.sql"), /if 'NO' <> 'yes'/);

console.log("merchant feedback checks passed");
