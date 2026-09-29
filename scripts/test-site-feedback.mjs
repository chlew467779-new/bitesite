import assert from "node:assert/strict";
import { daysWaiting, isUrgentMerchantTopic, isUrgentSiteTopic, parseSiteFeedback, parseSiteFeedbackUpdate } from "../lib/site-feedback-core.mjs";

const ok = parseSiteFeedback({ topic: "design", message: "  The menu text is small  ", contactEmail: " a@b.my ", page: "/store/kopi" });
assert.equal(ok.ok, true);
assert.equal(ok.message, "The menu text is small", "trimmed");
assert.equal(ok.contactEmail, "a@b.my");
assert.equal(ok.page, "/store/kopi");
assert.equal(ok.honeypot, false);

assert.equal(parseSiteFeedback({ topic: "x", message: "m" }).ok, false, "unknown topic");
assert.equal(parseSiteFeedback({ topic: "feature", message: "   " }).ok, false, "empty message");
assert.equal(parseSiteFeedback({ topic: "feature", message: "a".repeat(1001) }).ok, false, "too long");
assert.equal(parseSiteFeedback({ topic: "feature", message: "m", contactEmail: "nope" }).ok, false, "bad email");
assert.equal(parseSiteFeedback({ topic: "feature", message: "m", extra: 1 }).ok, false, "unknown field");
assert.equal(parseSiteFeedback({ topic: "feature", message: "m", page: "https://evil.test" }).page, null, "external page dropped");
assert.equal(parseSiteFeedback({ topic: "feature", message: "m", page: "//evil.test" }).page, null, "protocol-relative page dropped");
assert.equal(parseSiteFeedback({ topic: "feature", message: "m", page: "/" }).page, "/", "home page kept");
assert.equal(parseSiteFeedback({ topic: "feature", message: "m", website: "spam" }).honeypot, true, "honeypot");

assert.equal(isUrgentSiteTopic("problem"), true);
assert.equal(isUrgentSiteTopic("design"), false);
assert.equal(isUrgentMerchantTopic("listing"), true);
assert.equal(isUrgentMerchantTopic("suggestion"), false);

const id = "123e4567-e89b-12d3-a456-426614174000";
assert.deepEqual(parseSiteFeedbackUpdate({ ids: [id, id], status: "done" }), { ok: true, ids: [id], status: "done" }, "dedupes ids");
assert.equal(parseSiteFeedbackUpdate({ ids: [], status: "done" }).ok, false, "no ids");
assert.equal(parseSiteFeedbackUpdate({ ids: ["x"], status: "done" }).ok, false, "bad id");
assert.equal(parseSiteFeedbackUpdate({ ids: [id], status: "deleted" }).ok, false, "bad status");

const now = new Date("2026-12-01T12:00:00Z");
assert.equal(daysWaiting("2026-10-02T12:00:00Z", now), 60);
assert.equal(daysWaiting("2026-12-01T08:00:00Z", now), 0);
assert.equal(daysWaiting(null, now), null);

console.log("site feedback checks passed");
