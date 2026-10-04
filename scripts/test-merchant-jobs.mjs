/**
 * Job posts (#23): form rules (mirroring public.merchant_job_save), request parsing, error mapping,
 * apply links and wiring guards. Database behaviour: supabase/tests/merchant_jobs_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  JOB_LIMITS, JOB_REPORT_REASONS, JOB_TYPES, isJobFeatureMissing, jobDaysLeft, jobFormProblems, jobTypeLabel,
  jobWhatsappHref, mapJobRpcError, parseJobHide, parseJobRequest,
} from "../lib/merchant-jobs-core.mjs";
import { PRIVACY_POLICY } from "../lib/privacy-policy.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const ID = "00000000-0000-4000-8000-00000000e201";
const good = { action: "save", jobId: ID, title: " Kitchen helper ", jobType: "part_time", salary: " ", hours: "Sat-Sun", description: "Line 1\r\nLine 2" };

/* Limits and types match the database. */
const migration = await read("supabase/migrations/20261004120000_merchant_jobs.sql");
assert.match(migration, /job_type in \('full_time', 'part_time', 'temporary'\)/);
assert.deepEqual(JOB_TYPES.map((t) => t.value), ["full_time", "part_time", "temporary"]);
assert.match(migration, new RegExp(`char_length\\(title\\) between 2 and ${JOB_LIMITS.title}`));
assert.match(migration, new RegExp(`char_length\\(salary\\) between 1 and ${JOB_LIMITS.salary}`));
assert.match(migration, new RegExp(`char_length\\(hours\\) between 1 and ${JOB_LIMITS.hours}`));
assert.match(migration, new RegExp(`char_length\\(description\\) between 1 and ${JOB_LIMITS.description}`));
assert.match(migration, new RegExp(`>= ${JOB_LIMITS.openPosts} then perform private.merchant_write_error\\('JOB_LIMIT'\\)`));
assert.match(migration, new RegExp(`interval '${JOB_LIMITS.days} days'`));
assert.match(migration, new RegExp(`reason in \\(${JOB_REPORT_REASONS.map((r) => `'${r.value}'`).join(", ")}\\)`));
// The public read never exposes who posted it or Admin's hide note.
const grant = /grant select \(([^)]*)\)\s+on table public\.merchant_jobs to anon, authenticated/.exec(migration);
assert.ok(grant, "column grant present");
assert.ok(!/created_by|hidden_note|hidden_at|status/.test(grant[1]), "private columns not granted");

/* Form rules */
assert.deepEqual(jobFormProblems({ title: "Cook", jobType: "full_time", hours: "9-5", description: "x" }), {});
assert.ok(jobFormProblems({ title: "C", jobType: "full_time", hours: "9-5", description: "x" }).title);
assert.ok(jobFormProblems({ title: "Cook", jobType: "intern", hours: "9-5", description: "x" }).jobType);
assert.ok(jobFormProblems({ title: "Cook", jobType: "full_time", hours: "", description: "x" }).hours);
assert.ok(jobFormProblems({ title: "Cook", jobType: "full_time", hours: "9-5", description: "x".repeat(1001) }).description);
assert.ok(jobFormProblems({ title: "Cook", jobType: "full_time", hours: "9-5", salary: "x".repeat(81), description: "x" }).salary);
assert.ok(jobFormProblems({ title: "Co\u0007ok", jobType: "full_time", hours: "9-5", description: "x" }).title, "control characters");
assert.deepEqual(jobFormProblems({ title: "Cook", jobType: "full_time", hours: "9-5", description: "a\nb" }), {}, "line breaks allowed in the description");

/* Parsing */
assert.deepEqual(parseJobRequest(good), { ok: true, action: "save", jobId: ID, title: "Kitchen helper", jobType: "part_time", salary: null, hours: "Sat-Sun", description: "Line 1\nLine 2" });
assert.equal(parseJobRequest({ ...good, jobId: "x" }).ok, false);
assert.equal(parseJobRequest({ ...good, merchantId: ID }).ok, false, "unknown key");
assert.equal(parseJobRequest({ ...good, salary: 5 }).ok, false);
assert.deepEqual(parseJobRequest({ action: "renew", jobId: ID.toUpperCase() }), { ok: true, action: "renew", jobId: ID });
assert.equal(parseJobRequest({ action: "renew", jobId: ID, title: "x" }).ok, false);
assert.equal(parseJobRequest({ action: "publish", jobId: ID }).ok, false);
assert.equal(parseJobHide({ jobId: ID, hide: true, note: " " }).ok, false, "hide needs a note");
assert.deepEqual(parseJobHide({ jobId: ID, hide: false }), { ok: true, jobId: ID, hide: false, note: null });

/* Errors */
const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapJobRpcError(rpc("JOB_LIMIT")).status, 409);
assert.equal(mapJobRpcError(rpc("JOB_NOT_ALLOWED", "not_public")).code, "JOB_NOT_ALLOWED");
assert.equal(mapJobRpcError(rpc("RESOURCE_NOT_FOUND", "job")).status, 404);
assert.equal(mapJobRpcError({ code: "PGRST202", message: "Could not find the function" }).code, "FEATURE_OFF");
assert.ok(isJobFeatureMissing({ code: "42P01" }) && !isJobFeatureMissing(rpc("JOB_LIMIT")));

/* Helpers */
assert.equal(jobTypeLabel("part_time"), "Part-time");
assert.equal(jobWhatsappHref("+60 12-345 6789", "Cook", "Kopi Ah Seng"), `https://wa.me/60123456789?text=${encodeURIComponent('Hi Kopi Ah Seng, I saw your "Cook" job post on BiteSite and would like to apply.')}`);
assert.equal(jobWhatsappHref("123", "Cook", "X"), null);
assert.equal(jobDaysLeft(new Date(Date.UTC(2026, 9, 10)).toISOString(), Date.UTC(2026, 9, 4)), 6);
assert.equal(jobDaysLeft("2020-01-01T00:00:00Z"), 0);

/* Wiring */
const owner = await read("app/api/merchant/restaurants/[merchantId]/jobs/route.ts");
assert.match(owner, /requireMerchantUser\(request\)/);
assert.match(owner, /p_actor_type: 'owner', p_actor_id: auth\.user\.id/);
assert.match(owner, /rpc\('merchant_job_save'/);
assert.match(owner, /rpc\('merchant_job_action'/);
const admin = await read("app/api/admin/jobs/route.ts");
assert.match(admin, /verifyAdminToken\(token\)/);
for (const fn of ["merchant_job_admin_list", "merchant_job_admin_hide", "merchant_job_save", "merchant_job_action"]) assert.match(admin, new RegExp(`rpc\\('${fn}'`));
assert.match(await read("app/merchant/page.tsx"), /<JobsPanel /);
assert.match(await read("app/admin/page.tsx"), /activeTab === 'jobs' && <JobsAdmin \/>/);
const publicLib = await read("lib/jobs-public.ts");
assert.match(publicLib, /from '@\/lib\/supabase'/, "public reads use the anon client");
assert.doesNotMatch(publicLib, /supabase-admin/);

/* Privacy Policy mentions job posts in both languages. */
assert.match(JSON.stringify(PRIVACY_POLICY.en), /Job posts.*Applying for a job|Applying for a job/s);
assert.match(JSON.stringify(PRIVACY_POLICY.ms), /Iklan kerja/);
assert.match(JSON.stringify(PRIVACY_POLICY.ms), /Memohon kerja/);

console.log("merchant job checks passed");
