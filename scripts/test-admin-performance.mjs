import assert from "node:assert/strict";
import { compareKpi, contactRate, isLowContact, parseDays } from "../lib/admin-performance-core.mjs";
import { parseResultCount, visitorHash } from "../lib/visitor-hash.mjs";

assert.equal(parseDays("30"), 30);
assert.equal(parseDays("14"), 7, "unsupported period falls back to 7");
assert.equal(parseDays(null), 7);

assert.deepEqual(compareKpi(120, 100), { delta: 20, pct: 20, direction: "up" });
assert.deepEqual(compareKpi(50, 100), { delta: -50, pct: -50, direction: "down" });
assert.deepEqual(compareKpi(5, 5), { delta: 0, pct: 0, direction: "same" });
assert.deepEqual(compareKpi(3, 0), { delta: 3, pct: null, direction: "up" }, "no percentage of zero");
assert.equal(compareKpi(3, null), null, "no previous period");

assert.equal(contactRate(3, 40), 7.5);
assert.equal(contactRate(0, 0), null);
assert.equal(isLowContact({ views: 19, contacts: 0 }), false, "too few views to judge");
assert.equal(isLowContact({ views: 100, contacts: 1 }), true, "1% of 100 views");
assert.equal(isLowContact({ views: 100, contacts: 2 }), false, "2% is fine");

const a = visitorHash("203.0.113.9", "secret");
assert.match(a, /^[0-9a-f]{32}$/, "32 hex, matches the page_views_ip_hashed constraint");
assert.equal(visitorHash("203.0.113.9", "secret"), a, "stable, so distinct visitors can be counted");
assert.notEqual(visitorHash("203.0.113.9", "other"), a, "keyed");
assert.ok(!a.includes("203"), "no raw address");
assert.equal(visitorHash("203.0.113.9", ""), null, "no secret: store nothing");
assert.equal(visitorHash("unknown", "secret"), null);

assert.equal(parseResultCount(0), 0);
assert.equal(parseResultCount(12), 12);
assert.equal(parseResultCount(-1), null);
assert.equal(parseResultCount(1.5), null);
assert.equal(parseResultCount("3"), null);

console.log("admin performance: all checks passed");
