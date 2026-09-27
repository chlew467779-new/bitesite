#!/usr/bin/env node
/**
 * D2-B write cutover, HTTP level, against a LOCAL Supabase stack and local Next.js server:
 * every retired or closed write path refuses and leaves data unchanged, the hidden-draft create
 * accepts nothing but name/slug, and the B0 Admin paths work through the field save contract.
 *
 *   BASE_URL=http://localhost:3300 SUPABASE_URL=http://127.0.0.1:55321 \
 *   SUPABASE_ANON_KEY=<local> SUPABASE_SERVICE_ROLE_KEY=<local> ADMIN_PASSWORD=<local> \
 *   node scripts/test-d2b-cutover-local.mjs
 *
 * REFUSES non-local URLs. Synthetic zz-d2bc-* rows and d2bc-*@example.test users only; cleaned up.
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
const row = async (id) => (await admin.from("merchants").select("*").eq("id", id).maybeSingle()).data;

async function cleanup() {
  const { data } = await admin.from("merchants").select("id").like("slug", "zz-d2bc-%");
  const ids = (data || []).map((r) => r.id);
  if (ids.length) {
    await admin.from("merchant_memberships").delete().in("merchant_id", ids);
    await admin.from("merchant_external_links").delete().in("merchant_id", ids);
    await admin.from("merchants").delete().in("id", ids);
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users || []) if (/^d2bc-.*@example\.test$/.test(u.email || "")) await admin.auth.admin.deleteUser(u.id);
}

try {
  await cleanup();
  const { data: m } = await admin.from("merchants").insert({ slug: "zz-d2bc-a", name: "ZZ D2BC A", tagline: "T", website: "https://old.example", is_published: true, platform_status: "PUBLISHED", phone: "+60111111111", layout: "classic" }).select("id").single();
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = "d2bc-owner@example.test", password = `${crypto.randomUUID()}Aa1!`;
  const { data: user } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await admin.from("merchant_memberships").insert({ merchant_id: m.id, user_id: user.user.id, role: "owner", status: "active" });
  const token = (await anon.auth.signInWithPassword({ email, password })).data.session.access_token;
  const adminToken = (await call("POST", "/api/admin/login", { body: { password: adminPassword } })).json?.token;
  if (!adminToken) throw new Error("admin login failed");
  const before = await row(m.id);

  console.log("1) retired whole-form saves");
  let r = await call("PUT", `/api/merchant/me?merchantId=${m.id}`, { token, body: { tagline: "old form", website: "https://evil.example" } });
  expect("Merchant PUT /me -> 410 LEGACY_WRITE_RETIRED", r.status === 410 && r.json?.code === "LEGACY_WRITE_RETIRED", JSON.stringify(r));
  r = await call("PUT", `/api/merchant/me?merchantId=${crypto.randomUUID()}`, { token, body: { tagline: "x" } });
  expect("…a foreign id still gets 404 first (no existence leak)", r.status === 404, `status ${r.status}`);
  r = await call("PUT", "/api/admin/merchants-crud", { adminToken, body: { id: m.id, tagline: "admin old form", is_published: false, website: "https://evil.example", grabfood_url: "https://food.grab.com/x" } });
  expect("Admin PUT -> 410", r.status === 410 && r.json?.code === "LEGACY_WRITE_RETIRED", JSON.stringify(r));
  r = await call("DELETE", `/api/admin/merchants-crud?id=${m.id}`, { adminToken });
  expect("Admin DELETE -> 410", r.status === 410, JSON.stringify(r));
  expect("Admin PUT without token -> 401", (await call("PUT", "/api/admin/merchants-crud", { body: { id: m.id } })).status === 401, "");
  const after = await row(m.id);
  expect("…restaurant row unchanged (tagline, links, publication, revision)", after && after.tagline === before.tagline && after.website === before.website && after.is_published === before.is_published && after.revision === before.revision, JSON.stringify(after && { tagline: after.tagline, website: after.website, is_published: after.is_published, revision: after.revision }));
  const { count: links } = await admin.from("merchant_external_links").select("id", { count: "exact", head: true }).eq("merchant_id", m.id);
  expect("…no GrabFood link written", links === 0, `links ${links}`);

  console.log("2) hidden-draft create");
  r = await call("POST", "/api/admin/merchants-crud", { adminToken, body: { name: "ZZ D2BC New", slug: "zz-d2bc-new", is_published: true, website: "https://x.example" } });
  expect("create with publication/link fields -> 400 UNKNOWN_FIELD", r.status === 400 && r.json?.code === "UNKNOWN_FIELD", JSON.stringify(r));
  r = await call("POST", "/api/admin/merchants-crud", { adminToken, body: { name: "ZZ D2BC New", slug: "zz-d2bc-new" } });
  const created = r.json?.merchant;
  expect("create name+slug -> 201", r.status === 201 && created?.slug === "zz-d2bc-new", JSON.stringify(r));
  const createdRow = created ? await row(created.id) : null;
  expect("…is a hidden legacy draft", createdRow && createdRow.is_published === false && createdRow.platform_status === "DRAFT" && createdRow.state_source === "legacy", JSON.stringify(createdRow && { p: createdRow.is_published, s: createdRow.platform_status }));
  r = await call("POST", "/api/admin/merchants-crud", { adminToken, body: { name: "Dup", slug: "zz-d2bc-new" } });
  expect("duplicate slug -> 409", r.status === 409, JSON.stringify(r));
  r = await call("POST", "/api/admin/merchants-crud", { adminToken, body: { name: "Bad", slug: "Not A Slug!" } });
  expect("invalid slug -> 400", r.status === 400, JSON.stringify(r));

  console.log("3) profile image uploads closed, Story uploads open");
  const upload = { contentType: "image/webp", size: 1000 };
  r = await call("POST", `/api/merchant/media/upload-url?merchantId=${m.id}`, { token, body: { kind: "merchant", ...upload } });
  expect("Merchant profile upload ticket -> 403", r.status === 403 && r.json?.code === "FIELD_NOT_WRITABLE", JSON.stringify(r));
  r = await call("POST", `/api/merchant/media/upload-url?merchantId=${m.id}`, { token, body: { kind: "story", ...upload } });
  expect("Merchant Story upload ticket still issued (or storage not configured)", r.status === 200 || r.status === 503, JSON.stringify(r));
  r = await call("POST", "/api/admin/media/upload-url", { adminToken, body: { kind: "merchant", ...upload } });
  expect("Admin profile upload ticket -> 400", r.status === 400, JSON.stringify(r));
  r = await call("POST", "/api/admin/media/upload-url", { adminToken, body: { kind: "menu", ...upload } });
  expect("Admin menu image ticket still issued (or storage not configured)", r.status === 200 || r.status === 503, JSON.stringify(r));

  console.log("4) B0 Admin paths over HTTP");
  const fields = `/api/admin/merchants/${m.id}/fields`;
  r = await call("GET", fields, { adminToken });
  const snap = r.json?.data?.fields || {};
  expect("Admin snapshot has name/layout/tags/location", ["profile.name", "presentation.layout", "tags.cuisine", "location"].every((p) => p in snap), Object.keys(snap).join(","));
  r = await call("PATCH", fields, { adminToken, body: { requestId: crypto.randomUUID(), patches: [
    { path: "profile.name", expected: snap["profile.name"], value: "ZZ D2BC A Renamed" },
    { path: "presentation.layout", expected: snap["presentation.layout"], value: "modern" },
    { path: "tags.cuisine", expected: snap["tags.cuisine"], value: ["Chinese"] },
    { path: "location", expected: snap.location, value: { address: "1 Jalan", area: null, latitude: 0, longitude: 0 } },
  ] } });
  const renamed = await row(m.id);
  expect("Admin B0 section save applied", r.status === 200 && r.json?.data?.status === "applied" && renamed.name === "ZZ D2BC A Renamed" && renamed.slug === "zz-d2bc-a" && renamed.latitude === 0, JSON.stringify(r.json));
  r = await call("PATCH", fields, { adminToken, body: { requestId: crypto.randomUUID(), patches: [{ path: "tags.cuisine", expected: ex(["Chinese"]), value: ["Not A Preset"] }] } });
  expect("non-preset tag -> 400 with a field error", r.status === 400 && r.json?.error?.fieldErrors?.["tags.cuisine"], JSON.stringify(r.json));
  r = await call("PATCH", fields, { adminToken, body: { requestId: crypto.randomUUID(), patches: [{ path: "presentation.layout", expected: ex("modern"), value: "modern" }] } });
  expect("no-op returns the confirmed value", r.status === 200 && r.json?.data?.status === "noop" && r.json.data.values?.["presentation.layout"]?.value === "modern", JSON.stringify(r.json));
  r = await call("PATCH", `/api/merchant/restaurants/${m.id}/fields`, { token, body: { requestId: crypto.randomUUID(), patches: [{ path: "profile.name", expected: ex("ZZ D2BC A Renamed"), value: "Mine" }] } });
  expect("Owner cannot rename -> 400 FIELD_NOT_WRITABLE", r.status === 400 && r.json?.error?.code === "FIELD_NOT_WRITABLE", JSON.stringify(r.json));
  r = await call("PATCH", `/api/merchant/restaurants/${m.id}/fields`, { token, body: { requestId: crypto.randomUUID(), patches: [{ path: "profile.website", expected: ex("https://old.example"), value: "https://new.example" }] } });
  expect("Owner link change -> 400 FIELD_NOT_WRITABLE", r.status === 400 && r.json?.error?.code === "FIELD_NOT_WRITABLE", JSON.stringify(r.json));
} catch (error) {
  failed++;
  console.error(`  FAIL setup/run — ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
