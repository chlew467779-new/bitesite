#!/usr/bin/env node
/**
 * D2-A HTTP check of the field save endpoints and the two Merchant insert routes against a LOCAL
 * Supabase stack and a local Next.js server that uses it: identity comes from getUser / the Admin
 * session, errors map to the documented codes, and nothing in the body can change the actor.
 *
 *   BASE_URL=http://localhost:3200 SUPABASE_URL=http://127.0.0.1:55321 \
 *   SUPABASE_ANON_KEY=<local> SUPABASE_SERVICE_ROLE_KEY=<local> ADMIN_PASSWORD=<local> \
 *   node scripts/test-d2a-routes-local.mjs
 *
 * REFUSES any non-local URL. Creates only zz-d2r-* merchants and d2r-*@example.test users with
 * random passwords (never printed) and deletes them at the end. Not part of `npm run verify`.
 */
import { createClient } from "@supabase/supabase-js";

const base = (process.env.BASE_URL || "").replace(/\/+$/, "");
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const { SUPABASE_ANON_KEY: anonKey = "", SUPABASE_SERVICE_ROLE_KEY: serviceKey = "", ADMIN_PASSWORD: adminPassword = "" } = process.env;
const isLocal = (url) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
if (!base || !supabaseUrl || !anonKey || !serviceKey || !adminPassword) { console.error("Set BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and ADMIN_PASSWORD."); process.exit(2); }
if (!isLocal(base) || !isLocal(supabaseUrl)) { console.error("REFUSING: BASE_URL and SUPABASE_URL must be localhost."); process.exit(2); }

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let passed = 0, failed = 0;
const expect = (n, cond, why) => { if (cond) { passed++; console.log(`  ok   ${n}`); } else { failed++; console.error(`  FAIL ${n} — ${why}`); } };
const call = async (method, path, { token, adminToken, body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(adminToken ? { "x-admin-token": adminToken } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
};
const ex = (value) => ({ exists: true, value });
const patch = (patches, requestId = crypto.randomUUID()) => ({ requestId, patches });
const ids = {}, tokens = {};

async function cleanup() {
  const slugs = ["zz-d2r-a", "zz-d2r-b"];
  await admin.from("story_submissions").delete().in("merchant_slug", slugs);
  const { data } = await admin.from("merchants").select("id").in("slug", slugs);
  const merchantIds = (data || []).map((r) => r.id);
  if (merchantIds.length) {
    await admin.from("merchant_profile_change_requests").delete().in("merchant_id", merchantIds);
    await admin.from("merchant_memberships").delete().in("merchant_id", merchantIds);
    await admin.from("merchants").delete().in("id", merchantIds);
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users || []) if (/^d2r-.*@example\.test$/.test(u.email || "")) await admin.auth.admin.deleteUser(u.id);
}

try {
  await cleanup();
  for (const [key, row] of Object.entries({ a: { slug: "zz-d2r-a", name: "ZZ D2R A", tagline: "A", phone: "+60111111111", is_published: true, platform_status: "PUBLISHED", features: { gallery: false } }, b: { slug: "zz-d2r-b", name: "ZZ D2R B", tagline: "B" } })) {
    const { data, error } = await admin.from("merchants").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    ids[key] = data.id;
  }
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const [name, key] of [["a", "a"], ["b", "b"]]) {
    const email = `d2r-${name}@example.test`, password = `${crypto.randomUUID()}Aa1!`;
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    await admin.from("merchant_memberships").insert({ merchant_id: ids[key], user_id: data.user.id, role: "owner", status: "active" });
    tokens[name] = (await anon.auth.signInWithPassword({ email, password })).data.session.access_token;
  }
  const login = await call("POST", "/api/admin/login", { body: { password: adminPassword } });
  const adminToken = login.json?.token;
  if (!adminToken) throw new Error(`admin login failed (${login.status})`);

  const ownerFields = (id) => `/api/merchant/restaurants/${id}/fields`;
  const adminFields = (id) => `/api/admin/merchants/${id}/fields`;

  console.log("1) identity");
  expect("Owner GET without token -> 401", (await call("GET", ownerFields(ids.a))).status === 401, "");
  expect("Owner PATCH forged token -> 401", (await call("PATCH", ownerFields(ids.a), { token: "forged", body: patch([]) })).status === 401, "");
  expect("Admin PATCH without token -> 401", (await call("PATCH", adminFields(ids.a), { body: patch([]) })).status === 401, "");
  expect("Admin PATCH with an Owner bearer token -> 401", (await call("PATCH", adminFields(ids.a), { token: tokens.a, body: patch([]) })).status === 401, "");

  console.log("2) Owner read and save");
  let r = await call("GET", ownerFields(ids.a), { token: tokens.a });
  expect("Owner snapshot has profile/hours, no features", r.status === 200 && r.json?.data?.fields?.["profile.tagline"]?.value === "A" && !("features.gallery" in (r.json?.data?.fields || {})), JSON.stringify(r.json));
  const rev0 = r.json?.revision;
  r = await call("GET", ownerFields(ids.a), { token: tokens.b });
  expect("Owner B reading A -> 404 without data", r.status === 404 && !JSON.stringify(r.json).includes("zz-d2r-a"), JSON.stringify(r.json));
  const key = crypto.randomUUID();
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: patch([{ path: "profile.tagline", expected: ex("A"), value: "A2" }], key) });
  expect("Owner PATCH applied", r.status === 200 && r.json?.data?.status === "applied" && r.json?.revision === rev0 + 1 && r.json?.data?.values?.["profile.tagline"]?.value === "A2", JSON.stringify(r.json));
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: patch([{ path: "profile.tagline", expected: ex("A"), value: "A2" }], key) });
  expect("same request replayed", r.status === 200 && r.json?.replayed === true && r.json?.revision === rev0 + 1, JSON.stringify(r.json));
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: patch([{ path: "profile.tagline", expected: ex("A"), value: "A3" }], key) });
  expect("same key, other payload -> 409 IDEMPOTENCY_KEY_REUSED", r.status === 409 && r.json?.error?.code === "IDEMPOTENCY_KEY_REUSED", JSON.stringify(r.json));
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: patch([{ path: "profile.tagline", expected: ex("A"), value: "stale" }]) });
  expect("stale expected -> 409 FIELD_CONFLICT with current value", r.status === 409 && r.json?.error?.code === "FIELD_CONFLICT" && r.json.error.conflicts?.[0]?.current?.value === "A2", JSON.stringify(r.json));

  console.log("3) Owner refusals");
  r = await call("PATCH", ownerFields(ids.b), { token: tokens.a, body: patch([{ path: "profile.tagline", expected: ex("B"), value: "hijack" }]) });
  expect("Owner A PATCH B -> 404", r.status === 404, JSON.stringify(r.json));
  expect("…B unchanged", (await admin.from("merchants").select("tagline").eq("id", ids.b).single()).data.tagline === "B", "changed");
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: { ...patch([{ path: "profile.tagline", expected: ex("A2"), value: "x" }]), actor: "admin", userId: "someone" } });
  expect("body actor/userId -> 400 UNKNOWN_FIELD", r.status === 400 && r.json?.error?.code === "UNKNOWN_FIELD", JSON.stringify(r.json));
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: patch([{ path: "features.gallery", expected: ex(false), value: true }]) });
  expect("Owner feature -> 400 FIELD_NOT_WRITABLE", r.status === 400 && r.json?.error?.code === "FIELD_NOT_WRITABLE", JSON.stringify(r.json));
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: patch([{ path: "profile.website", expected: ex(null), value: "https://x.test" }]) });
  expect("Owner link -> 400 FIELD_NOT_WRITABLE", r.status === 400 && r.json?.error?.code === "FIELD_NOT_WRITABLE" && /Links/.test(r.json.error.message), JSON.stringify(r.json));
  r = await call("PATCH", ownerFields(ids.a), { token: tokens.a, body: patch([{ path: "profile.phone", expected: ex("+60111111111"), value: null }]) });
  expect("clearing the last contact of a public restaurant -> 422", r.status === 422 && r.json?.error?.code === "PUBLIC_CONTACT_MINIMUM", JSON.stringify(r.json));
  r = await call("PATCH", ownerFields("not-a-uuid"), { token: tokens.a, body: patch([{ path: "profile.tagline", expected: ex("A2"), value: "x" }]) });
  expect("malformed restaurant id -> 404", r.status === 404, JSON.stringify(r.json));

  console.log("4) Admin");
  r = await call("GET", adminFields(ids.a), { adminToken });
  expect("Admin snapshot includes features", r.status === 200 && r.json?.data?.fields?.["features.gallery"]?.value === false, JSON.stringify(r.json));
  r = await call("PATCH", adminFields(ids.a), { adminToken, body: patch([{ path: "features.gallery", expected: ex(false), value: true }, { path: "profile.whatsapp", expected: ex(null), value: "+60122222222" }]) });
  expect("Admin PATCH features + profile applied", r.status === 200 && r.json?.data?.status === "applied", JSON.stringify(r.json));
  const { data: log } = await admin.from("merchant_change_log").select("actor_type, actor_id, changed_paths").eq("merchant_id", ids.a).order("revision", { ascending: false }).limit(1).single();
  expect("audit records legacy_admin and leaf paths", log?.actor_type === "admin" && log?.actor_id === "legacy_admin" && JSON.stringify(log?.changed_paths) === JSON.stringify(["features.gallery", "profile.whatsapp"]), JSON.stringify(log));
  r = await call("PATCH", adminFields(ids.a), { adminToken, body: patch([{ path: "profile.instagram", expected: ex(null), value: "https://x.test" }]) });
  expect("Admin link -> 400 FIELD_NOT_WRITABLE", r.status === 400 && r.json?.error?.code === "FIELD_NOT_WRITABLE", JSON.stringify(r.json));

  console.log("5) Merchant inserts through the in-transaction RPCs");
  r = await call("POST", `/api/merchant/story-submissions?merchantId=${ids.a}`, { token: tokens.a, body: { title: "ZZ D2R", content: "Facts", rights_declared: true, merchant_slug: "zz-d2r-b" } });
  expect("Story POST -> 201 with the verified slug", r.status === 201 && r.json?.submission?.merchant_slug === "zz-d2r-a" && r.json?.submission?.channel === "self_service_form", JSON.stringify(r.json));
  r = await call("POST", `/api/merchant/story-submissions?merchantId=${ids.a}`, { token: tokens.a, body: { title: "Again", content: "Facts", rights_declared: true } });
  expect("second pending Story -> 409 as before", r.status === 409, JSON.stringify(r.json));
  r = await call("POST", `/api/merchant/profile-change-requests?merchantId=${ids.a}`, { token: tokens.a, body: { changes: { name: "ZZ D2R A New" } } });
  expect("change request POST -> 201 with the safe projection", r.status === 201 && r.json?.request?.status === "pending" && !("requested_by" in (r.json?.request || {})), JSON.stringify(r.json));
  r = await call("POST", `/api/merchant/profile-change-requests?merchantId=${ids.a}`, { token: tokens.a, body: { changes: { address: "x" } } });
  expect("second pending change request -> 409 as before", r.status === 409, JSON.stringify(r.json));
  await admin.from("merchants").update({ platform_status: "SUSPENDED" }).eq("id", ids.b);
  r = await call("POST", `/api/merchant/story-submissions?merchantId=${ids.b}`, { token: tokens.b, body: { title: "S", content: "x", rights_declared: true } });
  expect("Story for a suspended restaurant -> 403", r.status === 403, JSON.stringify(r.json));
  r = await call("PATCH", ownerFields(ids.b), { token: tokens.b, body: patch([{ path: "profile.tagline", expected: ex("B"), value: "x" }]) });
  expect("field save for a suspended restaurant -> 403 MERCHANT_SUSPENDED", r.status === 403 && r.json?.error?.code === "MERCHANT_SUSPENDED", JSON.stringify(r.json));
} catch (error) {
  failed++;
  console.error(`  FAIL setup/run — ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
