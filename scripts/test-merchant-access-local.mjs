#!/usr/bin/env node
/**
 * M1-A authorization check of the real merchant API routes against a LOCAL Supabase stack
 * (supabase start) and a local Next.js server that uses it.
 *
 *   BASE_URL=http://localhost:3000 SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<local anon key> SUPABASE_SERVICE_ROLE_KEY=<local service key> \
 *   node scripts/test-merchant-access-local.mjs
 *
 * REFUSES any non-local URL. Creates only zz-m1a-* merchants and m1a-*@example.test users with
 * random passwords that are never printed, and deletes them at the end. Not part of
 * `npm run verify` (it needs Docker and a running server).
 */
import { createClient } from "@supabase/supabase-js";

const base = (process.env.BASE_URL || "").replace(/\/+$/, "");
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const isLocal = (url) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
if (!base || !supabaseUrl || !anonKey || !serviceKey) { console.error("Set BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY."); process.exit(2); }
if (!isLocal(base) || !isLocal(supabaseUrl)) { console.error("REFUSING: BASE_URL and SUPABASE_URL must be localhost."); process.exit(2); }

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0, passed = 0;
const ok = (n) => { passed++; console.log(`  ok   ${n}`); };
const bad = (n, why) => { failed++; console.error(`  FAIL ${n} — ${why}`); };
const expect = (n, cond, why) => (cond ? ok(n) : bad(n, why));

const call = async (method, path, token, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
};
const withId = (path, id) => `${path}${path.includes("?") ? "&" : "?"}merchantId=${id}`;
const password = () => `${crypto.randomUUID()}Aa1!`;

const MERCHANTS = {
  a: { slug: "zz-m1a-alpha", name: "ZZ M1A Alpha" },
  b: { slug: "zz-m1a-beta", name: "ZZ M1A Beta" },
  c: { slug: "zz-m1a-gamma", name: "ZZ M1A Gamma" },
  d: { slug: "zz-m1a-delta", name: "ZZ M1A Delta" },
  s: { slug: "zz-m1a-suspended", name: "ZZ M1A Suspended", platform_status: "SUSPENDED" },
};
const USERS = { ownerA: ["a"], ownerB: ["b"], multi: ["c", "d"], suspended: ["s"], none: [] };
const ids = {}, users = {}, tokens = {};

async function cleanup() {
  const slugs = Object.values(MERCHANTS).map((m) => m.slug);
  await admin.from("story_submissions").delete().in("merchant_slug", slugs);
  const { data: rows } = await admin.from("merchants").select("id").in("slug", slugs);
  const merchantIds = (rows || []).map((r) => r.id);
  if (merchantIds.length) {
    await admin.from("merchant_profile_change_requests").delete().in("merchant_id", merchantIds);
    await admin.from("merchant_memberships").delete().in("merchant_id", merchantIds);
    await admin.from("merchants").delete().in("id", merchantIds);
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of list?.users || []) if (/^m1a-.*@example\.test$/.test(user.email || "")) await admin.auth.admin.deleteUser(user.id);
}

async function setup() {
  await cleanup();
  for (const [key, merchant] of Object.entries(MERCHANTS)) {
    const { data, error } = await admin.from("merchants").insert({ ...merchant, tagline: `tagline ${key}` }).select("id").single();
    if (error) throw new Error(`merchant ${key}: ${error.message}`);
    ids[key] = data.id;
  }
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const [name, owned] of Object.entries(USERS)) {
    const email = `m1a-${name.toLowerCase()}@example.test`, secret = password();
    const { data, error } = await admin.auth.admin.createUser({ email, password: secret, email_confirm: true });
    if (error) throw new Error(`user ${name}: ${error.message}`);
    users[name] = data.user.id;
    for (const key of owned) {
      const { error: membershipError } = await admin.from("merchant_memberships").insert({ merchant_id: ids[key], user_id: data.user.id, role: "owner", status: "active" });
      if (membershipError) throw new Error(`membership ${name}/${key}: ${membershipError.message}`);
    }
    const { data: session, error: signInError } = await anon.auth.signInWithPassword({ email, password: secret });
    if (signInError) throw new Error(`sign in ${name}: ${signInError.message}`);
    tokens[name] = session.session.access_token;
  }
}

const taglineOf = async (key) => (await admin.from("merchants").select("tagline").eq("id", ids[key]).single()).data?.tagline;
const storyBody = (extra = {}) => ({ title: "ZZ M1A story", content: "Synthetic facts.", rights_declared: true, ...extra });
const uploadBody = { kind: "merchant", contentType: "image/webp", size: 1000 };

try {
  await setup();

  console.log("1) signed out");
  for (const [method, path] of [["GET", "/api/merchant/me"], ["PUT", "/api/merchant/me"], ["GET", "/api/merchant/story-submissions"], ["POST", "/api/merchant/media/upload-url"], ["GET", "/api/merchant/profile-change-requests"]]) {
    const r = await call(method, path, undefined, method === "GET" ? undefined : {});
    expect(`${method} ${path} without token -> 401`, r.status === 401, `status ${r.status}`);
  }
  const forged = await call("GET", "/api/merchant/me", "not-a-real-token");
  expect("forged token -> 401", forged.status === 401, `status ${forged.status}`);

  console.log("2) no membership");
  let r = await call("GET", "/api/merchant/me", tokens.none);
  expect("GET /me -> 200 empty list, no merchant", r.status === 200 && Array.isArray(r.json?.merchants) && r.json.merchants.length === 0 && r.json.merchant === null, JSON.stringify(r));
  r = await call("PUT", "/api/merchant/me", tokens.none, { tagline: "x" });
  expect("PUT /me -> 404", r.status === 404, `status ${r.status}`);
  r = await call("PUT", withId("/api/merchant/me", ids.a), tokens.none, { tagline: "hijack" });
  expect("PUT someone's merchant -> 404", r.status === 404, `status ${r.status}`);
  r = await call("POST", "/api/merchant/story-submissions", tokens.none, storyBody());
  expect("Story POST -> 404", r.status === 404, `status ${r.status}`);

  console.log("3) Owner A / Owner B");
  r = await call("GET", "/api/merchant/me", tokens.ownerA);
  expect("Owner A GET /me without ID -> own profile", r.status === 200 && r.json?.merchant?.id === ids.a && r.json.merchants.length === 1, JSON.stringify(r.json));
  expect("profile is an explicit projection (no legacy reviews/settings)", r.json?.merchant && !("reviews" in r.json.merchant) && !("settings" in r.json.merchant), "private columns returned");
  r = await call("GET", withId("/api/merchant/me", ids.b), tokens.ownerA);
  expect("Owner A GET Owner B -> 404", r.status === 404 && !JSON.stringify(r.json).includes(MERCHANTS.b.slug), JSON.stringify(r.json));
  r = await call("PUT", withId("/api/merchant/me", ids.b), tokens.ownerA, { tagline: "written by A" });
  expect("Owner A PUT Owner B -> 404", r.status === 404, `status ${r.status}`);
  expect("…and Owner B's row is unchanged", (await taglineOf("b")) === "tagline b", "row changed");
  r = await call("PUT", withId("/api/merchant/me", ids.a), tokens.ownerA, { tagline: "A saved" });
  expect("Owner A PUT own -> 200", r.status === 200 && r.json?.merchant?.tagline === "A saved", JSON.stringify(r.json));
  expect("…and the row is updated", (await taglineOf("a")) === "A saved", "row not updated");
  r = await call("GET", withId("/api/merchant/story-submissions", ids.a), tokens.ownerB);
  expect("Owner B lists Owner A's Stories -> 404", r.status === 404, `status ${r.status}`);
  r = await call("POST", withId("/api/merchant/media/upload-url", ids.a), tokens.ownerB, uploadBody);
  expect("Owner B upload URL for Owner A -> 404", r.status === 404, `status ${r.status}`);
  r = await call("GET", "/api/merchant/me?merchantId=not-a-uuid", tokens.ownerA);
  expect("malformed ID -> 404", r.status === 404, `status ${r.status}`);
  r = await call("POST", withId("/api/merchant/story-submissions", ids.a), tokens.ownerA, storyBody({ merchant_slug: MERCHANTS.b.slug }));
  expect("Story POST uses the verified slug, not the body", r.status === 201 && r.json?.submission?.merchant_slug === MERCHANTS.a.slug, JSON.stringify(r.json));
  r = await call("POST", withId("/api/merchant/media/upload-url", ids.a), tokens.ownerA, uploadBody);
  expect("Owner A upload URL is under A's path", (r.status === 200 && String(r.json?.path).startsWith(`merchant/${MERCHANTS.a.slug}/`)) || r.status === 503, JSON.stringify(r.json));

  console.log("4) several restaurants");
  r = await call("GET", "/api/merchant/me", tokens.multi);
  expect("GET /me without ID -> list of 2, no default merchant", r.status === 200 && r.json?.merchants?.length === 2 && r.json.merchant === null, JSON.stringify(r.json));
  r = await call("PUT", "/api/merchant/me", tokens.multi, { tagline: "which one?" });
  expect("PUT without ID -> 409 MERCHANT_CONTEXT_REQUIRED", r.status === 409 && r.json?.code === "MERCHANT_CONTEXT_REQUIRED", JSON.stringify(r.json));
  expect("…and neither row changed", (await taglineOf("c")) === "tagline c" && (await taglineOf("d")) === "tagline d", "row changed");
  r = await call("POST", "/api/merchant/story-submissions", tokens.multi, storyBody());
  expect("Story POST without ID -> 409", r.status === 409 && r.json?.code === "MERCHANT_CONTEXT_REQUIRED", JSON.stringify(r.json));
  r = await call("PUT", withId("/api/merchant/me", ids.d), tokens.multi, { tagline: "D saved" });
  expect("PUT with ID -> only D changes", r.status === 200 && (await taglineOf("d")) === "D saved" && (await taglineOf("c")) === "tagline c", JSON.stringify(r.json));

  console.log("5) suspended restaurant");
  r = await call("GET", "/api/merchant/me", tokens.suspended);
  expect("GET /me -> readable, restriction suspended", r.status === 200 && r.json?.merchant?.restriction === "suspended", JSON.stringify(r.json));
  r = await call("PUT", withId("/api/merchant/me", ids.s), tokens.suspended, { tagline: "should not save" });
  expect("PUT -> 403 MERCHANT_SUSPENDED", r.status === 403 && r.json?.code === "MERCHANT_SUSPENDED", JSON.stringify(r.json));
  expect("…and the row is unchanged", (await taglineOf("s")) === "tagline s", "row changed");
  r = await call("POST", withId("/api/merchant/story-submissions", ids.s), tokens.suspended, storyBody());
  expect("Story POST -> 403", r.status === 403, `status ${r.status}`);
  r = await call("POST", withId("/api/merchant/media/upload-url", ids.s), tokens.suspended, uploadBody);
  expect("upload URL -> 403", r.status === 403, `status ${r.status}`);
  r = await call("POST", withId("/api/merchant/profile-change-requests", ids.s), tokens.suspended, { changes: { name: "New" } });
  expect("profile change request -> 403", r.status === 403, `status ${r.status}`);
  r = await call("GET", withId("/api/merchant/me", ids.s), tokens.ownerA);
  expect("another Owner asking for the suspended restaurant -> 404", r.status === 404, `status ${r.status}`);

  console.log("6) restaurant suspended during a session");
  await admin.from("merchants").update({ platform_status: "SUSPENDED" }).eq("id", ids.a);
  r = await call("PUT", withId("/api/merchant/me", ids.a), tokens.ownerA, { tagline: "after suspension" });
  expect("PUT after Admin suspends the restaurant is refused", r.status === 403 && (await taglineOf("a")) === "A saved", JSON.stringify(r.json));
} catch (error) {
  failed++;
  console.error(`  FAIL setup/run — ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
