/**
 * Privacy Policy (SYNC-071): both languages complete and parallel, CH's decisions present, the
 * retention promises backed by the nightly job, and the page linked where people sign up.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PRIVACY_CONTACT_EMAIL, PRIVACY_EFFECTIVE_DATE, PRIVACY_POLICY } from "../lib/privacy-policy.mjs";

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const textOf = (policy) => JSON.stringify(policy);

/* CH decisions 2026-10-04 */
assert.equal(PRIVACY_CONTACT_EMAIL, "bitesite.my@gmail.com");
assert.match(PRIVACY_EFFECTIVE_DATE.iso, /^\d{4}-\d{2}-\d{2}$/);
for (const lang of ["en", "ms"]) {
  const policy = PRIVACY_POLICY[lang];
  const text = textOf(policy);
  assert.ok(text.includes(PRIVACY_CONTACT_EMAIL), `${lang}: contact email`);
  assert.ok(policy.effective.includes(PRIVACY_EFFECTIVE_DATE[lang]), `${lang}: effective date`);
  assert.doesNotMatch(text, /TO CONFIRM|[Pp]ending review|Draft —/, `${lang}: no placeholders or draft marks`);
  assert.match(text, /30 (days|hari)/, `${lang}: deletion requests within 30 days`);
  assert.match(text, /12 (months|bulan)/, `${lang}: reports and feedback kept 12 months`);
  assert.match(text, /90 (days|hari)/, `${lang}: browsing detail 90 days`);
  assert.match(text, /Singap/, `${lang}: cross-border transfer named`);
  for (const service of ["Supabase", "Vercel", "Gmail", "Gemini", "Google Maps", "OpenStreetMap", "WhatsApp"]) assert.ok(text.includes(service), `${lang}: ${service} listed`);
}

/* Both languages say the same number of things in the same order. */
const shape = (policy) => policy.sections.map((s) => s.blocks.map((b) => (typeof b === "string" ? "p" : "list" in b ? `l${b.list.length}` : `i${b.items.length}`)).join(","));
assert.deepEqual(shape(PRIVACY_POLICY.ms), shape(PRIVACY_POLICY.en), "Malay mirrors English section by section");
assert.equal(PRIVACY_POLICY.en.sections.length, 12);
/* Singapore (#24): a PDPA section in both languages with a data protection contact. */
for (const lang of ["en", "ms"]) {
  const sg = PRIVACY_POLICY[lang].sections[9];
  assert.match(sg.title, /^10\. (People in Singapore|Orang di Singapura)$/, `${lang}: Singapore section`);
  assert.match(JSON.stringify(sg), /Personal Data Protection Act 2012 \(PDPA\)|Akta Perlindungan Data Peribadi 2012 Singapura \(PDPA\)/, `${lang}: PDPA named`);
  assert.ok(JSON.stringify(sg).includes(PRIVACY_CONTACT_EMAIL), `${lang}: DPO contact`);
  assert.match(PRIVACY_POLICY[lang].sections[0].blocks[0], /Singap/, `${lang}: Singapore in the opening line`);
}

/* Retention promises are carried out by the nightly job. */
const migration = await read("supabase/migrations/20261004100000_privacy_retention.sql");
assert.match(migration, /site_feedback\s+where status = 'done' and decided_at < now\(\) - interval '12 months'/);
assert.match(migration, /public_reports\s+where status in \('resolved', 'dismissed'\) and decided_at < now\(\) - interval '12 months'/);
assert.match(migration, /merchant_feedback\s+where status = 'resolved' and updated_at < now\(\) - interval '12 months'/);
assert.match(migration, /site_errors\s+where status = 'resolved' and resolved_at < now\(\) - interval '30 days'/);
assert.match(migration, /cron\.schedule\('privacy_retention_cleanup', '30 19 \* \* \*'/);

/* Linked where people need it. */
assert.match(await read("components/sections/footer.tsx"), /href(=|: )"\/privacy"/, "footer link");
assert.match(await read("app/merchant/login/page.tsx"), /mode === 'register' && <p[^\n]*href="\/privacy"/, "sign-up page link");
assert.match(await read("app/merchant/new/page.tsx"), /have read the <a href="\/privacy"/, "create-restaurant agreement mentions it");
assert.match(await read("app/sitemap.ts"), /\$\{siteUrl\}\/privacy/, "in the sitemap");
const page = await read("app/privacy/page.tsx");
assert.match(page, /id="english"/);
assert.match(page, /id="bahasa-melayu"/);
assert.match(page, /lang=\{policy\.lang\}/, "each language is marked for screen readers and search");

console.log("privacy policy checks passed");
