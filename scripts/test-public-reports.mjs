/**
 * Visitor reports: request parsing, error mapping and wiring. Database behaviour is tested by
 * supabase/tests/public_reports_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { REPORT_REASONS, mapReportRpcError, parseReportDecision, parseReportSubmit, reasonLabel } from "../lib/public-report-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const ID = "11111111-1111-4111-8111-111111111111";

// Reasons match the database constraint (latest version: the job posts migration adds target 'job').
const migration = await read("supabase/migrations/20261004120000_merchant_jobs.sql");
for (const [type, reasons] of Object.entries(REPORT_REASONS)) {
  const line = migration.split("\n").find((l) => l.includes(`target_type = '${type}'`) && l.includes("reason in ("));
  assert.ok(line, `${type} check found`);
  const m = /reason in \(([^)]*)\)/.exec(line);
  const inTable = m[1].split(",").map((v) => v.trim().replace(/'/g, "")).sort();
  assert.deepEqual(reasons.map((r) => r.value).sort(), inTable, `${type} reasons match the table check`);
}

assert.deepEqual(parseReportSubmit({ targetType: "merchant", slug: "kopi-ah-seng", reason: "hours", note: "  Closes at 5pm now ", contactEmail: " Me@Example.com " }),
  { ok: true, targetType: "merchant", slug: "kopi-ah-seng", reason: "hours", note: "Closes at 5pm now", contactEmail: "me@example.com", honeypot: false });
assert.equal(parseReportSubmit({ targetType: "merchant", slug: "kopi", reason: "rights" }).ok, false, "Story reason on a restaurant");
assert.equal(parseReportSubmit({ targetType: "story", slug: "../x", reason: "rights" }).ok, false, "slug format");
assert.equal(parseReportSubmit({ targetType: "job", slug: "00000000-0000-4000-8000-00000000e201", reason: "scam" }).ok, true, "job report by id");
assert.equal(parseReportSubmit({ targetType: "job", slug: "kopi-ah-seng", reason: "scam" }).ok, false, "job needs an id");
assert.equal(parseReportSubmit({ targetType: "job", slug: "00000000-0000-4000-8000-00000000e201", reason: "hours" }).ok, false, "restaurant reason on a job");
assert.equal(reasonLabel("job", "filled"), "The job is no longer available");
assert.equal(parseReportSubmit({ targetType: "story", slug: "s", reason: "rights", contactEmail: "nope" }).ok, false, "bad email");
assert.equal(parseReportSubmit({ targetType: "story", slug: "s", reason: "rights", merchantId: ID }).ok, false, "unknown keys refused");
assert.equal(parseReportSubmit({ targetType: "story", slug: "s", reason: "other", website: "http://spam" }).honeypot, true);
assert.equal(parseReportDecision({ id: ID, status: "resolved", note: "fixed" }).ok, true);
assert.equal(parseReportDecision({ id: ID, status: "deleted" }).ok, false);
assert.equal(reasonLabel("merchant", "closed"), "It has closed or moved");

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapReportRpcError(rpc("REPORT_LIMIT")).status, 429);
assert.equal(mapReportRpcError(rpc("RESOURCE_NOT_FOUND", "report_target")).status, 404);

const route = await read("app/api/reports/route.ts");
assert.match(route, /createHmac\('sha256', secret\)/, "reporter is an HMAC, not the IP");
assert.doesNotMatch(route, /p_reporter_hash: ip\b/, "raw IP never stored");
assert.match(route, /allowAnalyticsRequest\(`report:\$\{ip\}`\)/, "per-IP rate limit");
assert.match(route, /if \(parsed\.honeypot\) return/, "honeypot dropped");
assert.match(await read("app/api/admin/reports/route.ts"), /verifyAdminToken/);
const storePage = await read("app/store/[merchant]/page.tsx");
assert.match(storePage, /<ReportProblem targetType="merchant" slug=\{merchant\.slug\} \/>/);
const unavailableBranch = storePage.split("// Inactive merchant friendly page")[1]?.split("const [categories, products")[0];
assert.match(unavailableBranch, /<ReportProblem targetType="merchant" slug=\{merchant\.slug\} \/>/, "unavailable restaurant page includes reporting");
assert.match(await read("app/stories/[slug]/page.tsx"), /<ReportProblem targetType="story" slug=\{slug\} \/>/);
assert.match(await read("app/admin/components/admin-shell.tsx"), /id: 'reports'/);
assert.match(await read("app/admin/page.tsx"), /<ReportsInbox onOpenMerchantManager=\{\(\) => setActiveTab\('merchant-manager'\)\} onOpenJobs=\{\(\) => setActiveTab\('jobs'\)\} onOpenStoryEditor=\{openReportStory\} \/>/);
assert.match(await read("app/api/admin/attention/route.ts"), /count\('public_reports'\)\.eq\('status', 'new'\)/);
const form = await read("app/components/report-problem.tsx");
assert.match(form, /min-h-11/);
assert.match(form, /aria-hidden="true"[\s\S]*tabIndex=\{-1\}/, "honeypot hidden from people");

console.log("public report checks passed");
