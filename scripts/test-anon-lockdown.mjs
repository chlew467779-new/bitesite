#!/usr/bin/env node
/**
 * Black-box test of the Supabase Data API with the PUBLIC anon key.
 * STAGING ONLY. Needs supabase/staging/10_synthetic_seed.sql to be loaded.
 *
 *   STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co \
 *   STAGING_SUPABASE_ANON_KEY=<staging anon key> \
 *   node scripts/test-anon-lockdown.mjs
 *
 * Writes are attempted only against non-existent rows / with empty bodies, and the
 * script REFUSES to run against the production project. It never prints the key.
 */
const PROD_REF = "zpfkmzdtcbfpypntnkem";
const url = (process.env.STAGING_SUPABASE_URL || "").replace(/\/+$/, "");
const key = process.env.STAGING_SUPABASE_ANON_KEY || "";

if (!url || !key) { console.error("Set STAGING_SUPABASE_URL and STAGING_SUPABASE_ANON_KEY."); process.exit(2); }
if (url.includes(PROD_REF)) { console.error("REFUSING: this URL is the PRODUCTION project. Use the staging project."); process.exit(2); }

const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" };
let failed = 0, passed = 0;
const ok = (name) => { passed++; console.log(`  ok   ${name}`); };
const bad = (name, why) => { failed++; console.error(`  FAIL ${name} — ${why}`); };
const denied = (s) => s === 401 || s === 403;          // permission denied / RLS violation
const call = async (method, path, body) => {
  const res = await fetch(`${url}${path}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
};

const NO_ROW = {
  articles: "id=eq.00000000-0000-0000-0000-000000000000",
  categories: "id=eq.00000000-0000-0000-0000-000000000000",
  events: "id=eq.00000000-0000-0000-0000-000000000000",
  login_attempts: "id=eq.00000000-0000-0000-0000-000000000000",
  merchant_daily_views: "id=eq.00000000-0000-0000-0000-000000000000",
  merchant_monthly_views: "id=eq.-1",
  merchant_stats: "slug=eq.__zz_none__",
  merchant_videos: "id=eq.00000000-0000-0000-0000-000000000000",
  merchants: "id=eq.00000000-0000-0000-0000-000000000000",
  page_views: "id=eq.00000000-0000-0000-0000-000000000000",
  products: "id=eq.00000000-0000-0000-0000-000000000000",
  settings: "id=eq.-1",
};
const PATCH_BODY = { articles: { title: "x" }, categories: { name: "x" }, events: { title: "x" }, login_attempts: { ip: "x" },
  merchant_daily_views: { slug: "x" }, merchant_monthly_views: { slug: "x" }, merchant_stats: { view_count: 1 }, merchant_videos: { caption: "x" },
  merchants: { name: "x" }, page_views: { path: "x" }, products: { name: "x" }, settings: { value: "x" } };

console.log("A) anon must be denied every INSERT / UPDATE / DELETE");
for (const t of Object.keys(NO_ROW)) {
  let r = await call("POST", `/rest/v1/${t}`, {});
  denied(r.status) ? ok(`INSERT ${t} -> ${r.status}`) : bad(`INSERT ${t}`, `status ${r.status} (expected 401/403)`);
  r = await call("PATCH", `/rest/v1/${t}?${NO_ROW[t]}`, PATCH_BODY[t]);
  denied(r.status) ? ok(`UPDATE ${t} -> ${r.status}`) : bad(`UPDATE ${t}`, `status ${r.status} (expected 401/403)`);
  r = await call("DELETE", `/rest/v1/${t}?${NO_ROW[t]}`);
  denied(r.status) ? ok(`DELETE ${t} -> ${r.status}`) : bad(`DELETE ${t}`, `status ${r.status} (expected 401/403)`);
}

console.log("B) anon must be denied the counter RPCs");
for (const [fn, args] of [["increment_view_count", { merchant_slug: "__zz_none__" }], ["increment_article_view", { article_slug: "__zz_none__" }], ["aggregate_daily_views", {}]]) {
  const r = await call("POST", `/rest/v1/rpc/${fn}`, args);
  (denied(r.status) || r.status === 404) ? ok(`RPC ${fn} -> ${r.status}`) : bad(`RPC ${fn}`, `status ${r.status} (expected 401/403/404)`);
}

console.log("C) anon must not read server-only tables");
for (const t of ["page_views", "login_attempts", "merchant_daily_views", "merchant_monthly_views"]) {
  const r = await call("GET", `/rest/v1/${t}?select=*&limit=1`);
  denied(r.status) ? ok(`SELECT ${t} -> ${r.status}`) : bad(`SELECT ${t}`, `status ${r.status} (expected 401/403)`);
}

console.log("D) public reads still work and are filtered");
const rows = async (path) => { const r = await call("GET", path); return r.status === 200 && Array.isArray(r.json) ? r.json : null; };
const check = (name, cond) => (cond ? ok(name) : bad(name, "unexpected result"));
let d;
d = await rows("/rest/v1/merchants?select=slug&slug=like.zz-sec-test-*");
check("published merchant visible", !!d && d.some((x) => x.slug === "zz-sec-test-published"));
check("unpublished merchant hidden", !!d && !d.some((x) => x.slug === "zz-sec-test-draft"));
d = await rows("/rest/v1/articles?select=slug&slug=like.zz-sec-test-*");
check("published story visible", !!d && d.some((x) => x.slug === "zz-sec-test-story-published"));
check("draft story hidden", !!d && !d.some((x) => x.slug === "zz-sec-test-story-draft"));
d = await rows("/rest/v1/products?select=name&name=like.ZZ*");
check("product of published merchant visible", !!d && d.some((x) => x.name === "ZZ Published Product"));
check("product of unpublished merchant hidden", !!d && !d.some((x) => x.name === "ZZ Draft Product"));
d = await rows("/rest/v1/categories?select=name&name=like.ZZ*");
check("category of published merchant visible / draft hidden", !!d && d.some((x) => x.name === "ZZ Published Category") && !d.some((x) => x.name === "ZZ Draft Category"));
d = await rows("/rest/v1/events?select=title");
check("events readable", !!d && d.some((x) => x.title === "ZZ Published Event"));
d = await rows("/rest/v1/merchant_stats?select=slug&slug=eq.zz-sec-test-published");
check("merchant_stats readable", !!d && d.length === 1);
d = await rows("/rest/v1/settings?select=key");
check("public settings readable", !!d && d.some((x) => x.key === "site_title"));
check("non-allow-listed setting hidden", !!d && !d.some((x) => x.key === "zz_private_test_key"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
