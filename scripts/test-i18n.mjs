// R8 interface languages: the three dictionaries stay in step and every key the code uses exists.
import { REPORT_REASONS } from "../lib/public-report-core.mjs";
import assert from "node:assert/strict";
import ts from "typescript";
import { runInNewContext } from "node:vm";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (rel) => (await readFile(new URL(rel, root), "utf8")).replace(/\r\n/g, "\n");
const dicts = {};
for (const lang of ["en", "zh", "ms"]) dicts[lang] = JSON.parse(await read(`lib/i18n/${lang}.json`));

const keys = Object.keys(dicts.en).sort();
for (const lang of ["zh", "ms"]) {
  assert.deepEqual(Object.keys(dicts[lang]).sort(), keys, `${lang}.json has exactly the English keys`);
}
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
for (const key of keys) {
  for (const lang of ["en", "zh", "ms"]) {
    assert.ok(typeof dicts[lang][key] === "string" && dicts[lang][key].trim(), `${lang}:${key} is not empty`);
  }
  assert.deepEqual(placeholders(dicts.zh[key]), placeholders(dicts.en[key]), `zh:${key} keeps the same {placeholders}`);
  assert.deepEqual(placeholders(dicts.ms[key]), placeholders(dicts.en[key]), `ms:${key} keeps the same {placeholders}`);
}

// Every literal t("…") / t('…') in the source refers to a real key.
async function walk(dir, out = []) {
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const rel = `${dir}${entry.name}`;
    if (entry.isDirectory()) { if (!["node_modules", ".next"].includes(entry.name)) await walk(`${rel}/`, out); }
    else if (/\.(tsx?|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}
const used = new Set();
for (const file of [...await walk("app/"), ...await walk("components/")]) {
  for (const m of (await read(file)).matchAll(/\bt\(\s*["']([a-z][A-Za-z0-9_.]*)["']/g)) used.add(m[1]);
}
assert.ok(used.size > 50, "the interface uses the dictionary");
for (const key of used) assert.ok(key in dicts.en, `t("${key}") exists in lib/i18n/en.json`);

console.log(`i18n checks passed (${keys.length} keys, ${used.size} used)`);

const reportSource = await read("app/components/report-problem.tsx");
for (const [target, options] of Object.entries(REPORT_REASONS)) {
  const map = reportSource.match(new RegExp(`const ${target.toUpperCase()}_REASON_KEYS[^=]*=\\s*\\{([\\s\\S]*?)\\};`))?.[1];
  assert.ok(map, `the ${target} report has a label map`);
  for (const { value } of options) {
    const key = map.match(new RegExp(`\\b${value}:\\s*['"]([^'"]+)['"]`))?.[1];
    assert.ok(key && key in dicts.en, `report ${target}:${value} has a translated label`);
  }
}
console.log("All public report reasons have translated labels; backend values stay unchanged.");

// Status codes localise, while missing/unknown values retain the dashboard fallback contract.
const dashboard = await read("app/merchant/page.tsx");
const statusSource = "function statusLabel" + dashboard.split("function statusLabel")[1].split("async function readJson")[0];
const statusLabel = runInNewContext(ts.transpileModule(statusSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "; statusLabel");
const statusKeys = { draft: "owner.common.draft", pending: "owner.common.pendingReview", PENDING_REVIEW: "owner.common.pendingReview", approved: "owner.common.approved", rejected: "owner.common.rejected", PUBLISHED: "owner.common.published", SUSPENDED: "owner.common.suspended", archived: "owner.common.archived", OPEN: "owner.common.open", TEMPORARILY_CLOSED: "owner.closure.temporarilyClosed", MOVED: "owner.common.moved", PERMANENTLY_CLOSED: "owner.common.permanentlyClosed" };
for (const lang of ["en", "zh", "ms"]) {
  const t = (key) => dicts[lang][key];
  for (const [value, key] of Object.entries(statusKeys)) assert.equal(statusLabel(value, "fallback", t), t(key), `${lang}: ${value}`);
  assert.equal(statusLabel("FUTURE_VENDOR_STATE", "fallback", t), "Future vendor state");
  for (const value of [null, undefined, ""]) assert.equal(statusLabel(value, t("owner.common.draft"), t), t("owner.common.draft"));
}
console.log("Owner statuses localise in all three languages; unknown enums keep their previous display.");
