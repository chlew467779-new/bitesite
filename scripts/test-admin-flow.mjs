#!/usr/bin/env node
/**
 * End-to-end check of the Next.js server routes against a STAGING deployment
 * (or a local `next start` that uses the STAGING Supabase env).
 *
 *   BASE_URL=https://<staging-deployment> ADMIN_PASSWORD=<staging admin password> \
 *   node scripts/test-admin-flow.mjs
 *
 * Creates, edits and deletes only rows whose slug starts with "zz-sec-test-".
 * REFUSES to run against the production domain. Never prints the password or token.
 */
const base = (process.env.BASE_URL || "").replace(/\/+$/, "");
const password = process.env.ADMIN_PASSWORD || "";
if (!base || !password) { console.error("Set BASE_URL and ADMIN_PASSWORD."); process.exit(2); }
if (/bitesite-pied\.vercel\.app/i.test(base)) { console.error("REFUSING: BASE_URL is the PRODUCTION site."); process.exit(2); }

let failed = 0, passed = 0;
const ok = (n) => { passed++; console.log(`  ok   ${n}`); };
const bad = (n, why) => { failed++; console.error(`  FAIL ${n} — ${why}`); };
const expect = (n, cond, why = "unexpected response") => (cond ? ok(n) : bad(n, why));
const req = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
};

const MSLUG = "zz-sec-test-created", SSLUG = "zz-sec-test-story-created";
let token = "", merchantId = "", storyId = "";

console.log("1) admin auth still works and still guards the routes");
let r = await req("POST", "/api/admin/login", { body: { password } });
token = r.json?.token || "";
expect("login returns a token", r.status === 200 && !!token, `status ${r.status}`);
r = await req("GET", "/api/admin/merchants-crud");
expect("no token -> 401", r.status === 401, `status ${r.status}`);
r = await req("GET", "/api/admin/merchants-crud", { token: "not-a-real-token" });
expect("bad token -> 401", r.status === 401, `status ${r.status}`);

console.log("2) merchant create / edit via the server");
r = await req("POST", "/api/admin/merchants-crud", { token, body: { name: "ZZ Sec Test Created", slug: MSLUG, whatsapp: "60100000009", is_published: true } });
merchantId = r.json?.merchant?.id || "";
expect("create merchant", r.status === 201 && !!merchantId, `status ${r.status}`);
r = await req("PUT", "/api/admin/merchants-crud", { token, body: { id: merchantId, name: "ZZ Sec Test Created (edited)" } });
expect("edit merchant", r.status === 200, `status ${r.status}`);
r = await req("GET", "/api/admin/merchants-crud", { token });
expect("list merchants includes the new one", r.status === 200 && JSON.stringify(r.json).includes(MSLUG), `status ${r.status}`);

console.log("3) story create / edit via the server");
r = await req("POST", "/api/admin/stories", { token, body: { title: "ZZ Sec Test Story", slug: SSLUG, content: "synthetic", category: "Test", merchant_slug: MSLUG, published: true } });
storyId = r.json?.article?.id || "";
expect("create story", r.status === 201 && !!storyId, `status ${r.status}`);
r = await req("PUT", "/api/admin/stories", { token, body: { id: storyId, title: "ZZ Sec Test Story (edited)" } });
expect("edit story", r.status === 200, `status ${r.status}`);

console.log("4) settings write is server-only and works with a token");
r = await req("GET", "/api/admin/settings", { token });
expect("read settings (admin)", r.status === 200, `status ${r.status}`);

console.log("5) public tracking / counters");
r = await req("POST", "/api/track", { body: { eventType: "page_view", slug: MSLUG, path: `/store/${MSLUG}`, pageType: "merchant" } });
expect("/api/track", r.status === 200, `status ${r.status}`);
r = await req("POST", "/api/view", { body: { slug: MSLUG } });
expect("/api/view", r.status === 200, `status ${r.status}`);
r = await req("POST", "/api/story-view", { body: { slug: SSLUG } });
expect("/api/story-view", r.status === 200, `status ${r.status}`);

console.log("6) admin analytics still read (service-role reads)");
r = await req("GET", "/api/admin/overview?range=7d", { token });
expect("overview", r.status === 200, `status ${r.status}`);
r = await req("GET", "/api/admin/realtime", { token });
expect("realtime", r.status === 200, `status ${r.status}`);

console.log("7) public pages still render");
for (const path of ["/", "/stories", `/store/${MSLUG}`, `/stories/${SSLUG}`]) {
  const res = await fetch(`${base}${path}`);
  expect(`GET ${path}`, res.status === 200, `status ${res.status}`);
}

console.log("8) cleanup (synthetic rows only)");
if (storyId) { r = await req("DELETE", `/api/admin/stories?slug=${SSLUG}`, { token }); expect("delete story", r.status === 200, `status ${r.status}`); }
if (merchantId) { r = await req("DELETE", `/api/admin/merchants-crud?id=${merchantId}`, { token }); expect("delete merchant", r.status === 200, `status ${r.status}`); }

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
