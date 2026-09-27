/**
 * D2-C Admin governance: request parsing, error mapping and wiring guards.
 * Database behaviour is tested by supabase/tests/d2c_governance_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  GOVERNANCE_ACTIONS,
  GOVERNANCE_ACTION_INFO,
  describeGovernanceState,
  governanceResponse,
  mapGovernanceRpcError,
  parseGovernanceRequest,
} from "../lib/merchant-governance-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2c001";

/* ── request parsing ─────────────────────────────────────────────────────────────────────── */

assert.deepEqual(GOVERNANCE_ACTIONS, ["publish", "hide", "suspend", "unsuspend", "archive", "restore"]);
assert.equal(parseGovernanceRequest({ requestId: REQ, action: "set_business_status", businessStatus: "OPEN" }).ok, true, "reopen needs no reason");
assert.equal(parseGovernanceRequest({ requestId: REQ, action: "set_business_status", businessStatus: "MOVED" }).ok, false, "closing needs a reason");
assert.equal(parseGovernanceRequest({ requestId: REQ, action: "set_business_status", businessStatus: "GONE", reason: "x" }).ok, false, "unknown status");
assert.equal(parseGovernanceRequest({ requestId: REQ, action: "hide", reason: "x", businessStatus: "OPEN" }).ok, false, "status only with its action");
assert.deepEqual(parseGovernanceRequest({ requestId: REQ, action: "publish" }), { ok: true, requestId: REQ, action: "publish", reason: null });
assert.deepEqual(parseGovernanceRequest({ requestId: REQ, action: "hide", reason: "  Wrong prices  " }), { ok: true, requestId: REQ, action: "hide", reason: "Wrong prices" });
for (const [body, label] of [
  [null, "no body"],
  [[], "array"],
  [{ requestId: "x", action: "hide", reason: "r" }, "bad request id"],
  [{ requestId: REQ, action: "delete", reason: "r" }, "unknown action"],
  [{ requestId: REQ, action: "hide" }, "hide without reason"],
  [{ requestId: REQ, action: "suspend", reason: "   " }, "blank reason"],
  [{ requestId: REQ, action: "unsuspend", reason: "x".repeat(501) }, "reason too long"],
  [{ requestId: REQ, action: "publish", reason: 5 }, "reason not text"],
  [{ requestId: REQ, action: "publish", is_published: true }, "extra field"],
]) {
  const result = parseGovernanceRequest(body);
  assert.equal(result.ok, false, label);
  assert.equal(result.status, 400, label);
}
for (const action of GOVERNANCE_ACTIONS) assert.equal(GOVERNANCE_ACTION_INFO[action].reasonRequired, action !== "publish", `${action}: reason rule`);

/* ── RPC errors and responses ────────────────────────────────────────────────────────────── */

const rpc = (message, details = "") => ({ code: "P0001", message, details });
assert.equal(mapGovernanceRpcError(rpc("RESOURCE_NOT_FOUND")).status, 404);
assert.match(mapGovernanceRpcError(rpc("OPERATION_FORBIDDEN", "archived")).message, /archived/);
assert.match(mapGovernanceRpcError(rpc("OPERATION_FORBIDDEN", "suspended")).message, /Lift the suspension/);
assert.match(mapGovernanceRpcError(rpc("OPERATION_FORBIDDEN", "managed_visibility")).message, /Owner/);
assert.equal(mapGovernanceRpcError(rpc("OPERATION_FORBIDDEN", "archived")).status, 409);
assert.equal(mapGovernanceRpcError(rpc("PUBLIC_CONTACT_MINIMUM")).status, 422);
assert.equal(mapGovernanceRpcError(rpc("IDEMPOTENCY_KEY_REUSED")).status, 409);
assert.equal(mapGovernanceRpcError({ code: "42501", message: "permission denied" }).status, 500, "unknown errors are not leaked");
assert.equal(mapGovernanceRpcError(rpc("SOMETHING_ELSE")).status, 500);
const applied = governanceResponse({ status: "applied", action: "hide", revision: 4, state: { public: false }, replayed: true }, REQ);
assert.deepEqual([applied.status, applied.body.data.status, applied.body.revision, applied.body.replayed], [200, "applied", 4, true]);
assert.equal(governanceResponse({ status: "noop", action: "hide" }, REQ).body.data.status, "noop");
assert.equal(governanceResponse(null, REQ).status, 500);

/* ── state labels ────────────────────────────────────────────────────────────────────────── */

const base = { stateSource: "legacy", public: false, restriction: "none", platformStatus: "DRAFT", reviewStatus: "draft" };
assert.equal(describeGovernanceState({ ...base, public: true }), "Public");
assert.equal(describeGovernanceState(base), "Hidden");
assert.equal(describeGovernanceState({ ...base, restriction: "suspended" }), "Suspended");
assert.equal(describeGovernanceState({ ...base, restriction: "archived" }), "Archived");
assert.equal(describeGovernanceState({ ...base, platformStatus: "PENDING_REVIEW" }), "Hidden (waiting for review)");
assert.equal(describeGovernanceState(null), "Unknown");

/* ── wiring (source level) ───────────────────────────────────────────────────────────────── */

const route = await read("app/api/admin/merchants/[merchantId]/status/route.ts");
assert.match(route, /verifyAdminToken/, "Admin session is verified");
assert.match(route, /p_actor_type: 'admin',\s*p_actor_id: ADMIN_PRINCIPAL/, "the actor is server-built");
assert.match(route, /rpc\('merchant_governance_apply'/);
assert.match(route, /rpc\('merchant_business_status_set'/);
assert.doesNotMatch(route, /\.from\('merchants'\)\.update|\.update\(/, "no direct merchant UPDATE");
for (const path of ["'/'", "'/our-partner'", "'/sitemap.xml'", "`/store/${data.slug}`"]) assert.ok(route.includes(`revalidatePath(${path})`), `refreshes ${path}`);

const panelSource = await read("app/admin/components/merchant-status-panel.tsx");
assert.match(panelSource, /state\.allowedActions\.map/, "only allowed actions are offered");
assert.match(panelSource, /setUnknown\(pending\)/, "an unconfirmed result keeps the request for a safe retry");
assert.match(panelSource, /send\(unknown\)/, "retry resends the same request id");
const form = await read("app/admin/components/merchant-form.tsx");
assert.match(form, /<MerchantStatusPanel /, "the editor shows the governance panel");
assert.doesNotMatch(form, /Status \(read only\)/);

const crud = await read("app/api/admin/merchants-crud/route.ts");
assert.doesNotMatch(crud, /updateData\.is_published|updateData\.platform_status/, "no other route writes visibility");

/* ── migration shape ─────────────────────────────────────────────────────────────────────── */

const migration = await read("supabase/migrations/20260927090000_merchant_governance.sql");
for (const fn of ["merchant_governance_read", "merchant_governance_apply"]) {
  const body = migration.slice(migration.indexOf(`function public.${fn}(`));
  assert.match(body.slice(0, body.indexOf("as $$")), /security invoker\s+set search_path = ''/, `${fn}: invoker, empty search_path`);
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`), `${fn}: revoked`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`), `${fn}: service_role only`);
}
assert.doesNotMatch(migration, /security definer/i);
assert.match(migration, /p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin'/, "Admin only");
assert.match(migration, /for update;/, "the row is locked");
const rollback = await read("supabase/rollback/20260927090000_merchant_governance.rollback.STAGING_ONLY.sql");
assert.match(rollback, /if 'NO' <> 'yes' then/, "rollback switch is off by default");

console.log("merchant governance checks passed");

// Synthetic list states: stale legacy flags and canonical managed visibility.
const { merchantListState } = await import('../lib/merchant-list-state.mjs');
for (const [platform_status, is_published, visibility] of [['PUBLISHED', true, 'Public'], ['DRAFT', false, 'Hidden'], ['SUSPENDED', true, 'Suspended'], ['ARCHIVED', true, 'Archived']]) {
  const state = merchantListState({platform_status, is_published});
  assert.equal(state.visibility, visibility);
  assert.equal(state.isPublic, visibility === 'Public');
}
for (const [business_status, label] of [['OPEN', 'Open'], ['TEMPORARILY_CLOSED', 'Temporarily closed'], ['MOVED', 'Moved'], ['PERMANENTLY_CLOSED', 'Permanently closed']]) {
  const state = merchantListState({business_status, is_published: true});
  assert.equal(state.businessLabel, label);
  assert.equal(state.isOpen, business_status === 'OPEN');
  assert.equal(state.isPublic, true, 'legacy business closure alone does not hide a listing');
}
const managed = {state_source:'managed', review_status:'approved', listing_visibility:'public', platform_restriction:'none', business_status:'OPEN', is_published:false};
assert.equal(merchantListState(managed).isPublic, true);
for (const change of [{review_status:'draft'}, {listing_visibility:'hidden'}, {platform_restriction:'suspended'}, {platform_restriction:'archived'}, {business_status:'MOVED'}, {business_status:'PERMANENTLY_CLOSED'}]) assert.equal(merchantListState({...managed,...change}).isPublic,false);
assert.equal(merchantListState({business_status:'OPEN',status:'inactive'}).isOpen,true,'canonical business state wins');
