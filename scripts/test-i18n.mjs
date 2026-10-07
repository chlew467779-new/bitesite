// R8 interface languages: the three dictionaries stay in step and every key the code uses exists.
import assert from "node:assert/strict";
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
