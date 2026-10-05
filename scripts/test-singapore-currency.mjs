/**
 * Singapore (#24): price currency per restaurant. formatPrice shows RM or S$, every public price
 * passes the restaurant's currency, the column is public, and the Owner/create paths are wired.
 * Database behaviour: supabase/tests/singapore_currency_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { CURRENCIES, currencyAreaMismatch, currencySymbol, formatPrice } from "../lib/price-format.mjs";
import { PUBLIC_MERCHANT_COLUMNS } from "../lib/public-merchant-projection.mjs";
import { validateRestaurantDraft } from "../lib/merchant-auth-validation.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

assert.deepEqual(CURRENCIES.map((c) => c.code), ["MYR", "SGD"]);
assert.equal(formatPrice(2.5), "RM 2.50", "RM by default (old callers)");
assert.equal(formatPrice("12", "MYR"), "RM 12.00");
assert.equal(formatPrice(3.8, "SGD"), "S$ 3.80");
assert.equal(formatPrice(3.8, "XYZ"), "RM 3.80", "unknown currency falls back to RM");
assert.equal(formatPrice(null, "SGD"), "");
assert.equal(currencySymbol(undefined), "RM");

/* The column is public and the DB allows exactly these codes. */
assert.ok(PUBLIC_MERCHANT_COLUMNS.includes("currency"));
const migration = await read("supabase/migrations/20261004130000_singapore_currency.sql");
assert.match(migration, /check \(currency in \('MYR', 'SGD'\)\)/);
assert.match(migration, /grant select \(currency\) on table public\.merchants to anon, authenticated;/);
assert.match(migration, /DEPLOY ORDER: this SQL FIRST/);

/* Every public price shows the restaurant's currency. */
const files = [
  ...(await readdir(new URL("../app/layouts/", import.meta.url))).filter((f) => f.endsWith("-layout.tsx")).map((f) => `app/layouts/${f}`),
  "app/components/sections/tier-sections.tsx",
];
assert.equal(files.length, 8, "7 layouts + featured dishes");
for (const file of files) {
  const source = await read(file);
  const calls = [...source.matchAll(/formatPrice\(([^()]*)\)/g)].map((m) => m[1]);
  assert.ok(calls.length > 0, `${file} formats prices`);
  for (const args of calls) assert.match(args, /, merchant\.currency$/, `${file}: formatPrice(${args}) passes the currency`);
  assert.doesNotMatch(source, /`RM \$\{/, `${file}: no hard-coded RM`);
}
const ownerMenu = await read("app/merchant/components/menu-manager.tsx");
assert.doesNotMatch(ownerMenu, /`RM |\(RM\)/, "owner menu editor has no hard-coded RM");
assert.match(ownerMenu, /priceLabel\(product, currency\)/);
const adminMenu = await read("app/admin/components/menu-editor.tsx");
assert.doesNotMatch(adminMenu, /\(RM\)/, "Admin menu editor has no hard-coded RM");
for (const m of adminMenu.matchAll(/formatPrice\(([^()]*)\)/g)) assert.match(m[1], /, currency$/, "Admin menu prices pass the currency");
assert.match(await read("app/admin/components/merchant-form.tsx"), /<MenuEditor [^>]*currency=\{current\.currency\}/);

/* Create: country choice -> currency; Owner can change it later. */
assert.equal(validateRestaurantDraft({ name: "A", requestId: "00000000-0000-4000-8000-000000000001", termsVersion: "2026-09-pilot", rightsDeclared: true, currency: "SGD" })?.currency, "SGD");
const create = await read("app/api/merchant/restaurants/route.ts");
assert.match(create, /input\.currency === 'SGD'[\s\S]*rpc\('merchant_currency_set', \{ p_actor_type: 'owner', p_actor_id: auth\.user\.id/);
assert.match(await read("app/merchant/new/page.tsx"), /rightsDeclared, currency \}/);
const route = await read("app/api/merchant/restaurants/[merchantId]/currency/route.ts");
assert.match(route, /rpc\('merchant_currency_set', \{ p_actor_type: 'owner', p_actor_id: auth\.user\.id/);
assert.match(route, /owned\.merchants\.some/, "GET only for the restaurant's Owner");
assert.match(await read("app/merchant/page.tsx"), /<CurrencySetting /);

/* Singapore restaurants are not described as Malaysian (search engines, share previews). */
const store = await read("app/store/[merchant]/page.tsx");
assert.match(store, /addressCountry: merchant\.currency === "SGD" \? "SG" : "MY"/);
assert.match(store, /locale: merchant\.currency === "SGD" \? "en_SG" : "en_MY"/);
assert.doesNotMatch(await read("app/admin/components/restaurant-review-queue.tsx"), /RM \$\{/, "review queue uses the restaurant's currency");
assert.match(await read("app/api/admin/restaurant-reviews/route.ts"), /select\('id, currency'\)/);

// T6: currency vs the area's country (a reminder, never a refusal).
assert.equal(currencyAreaMismatch("MYR", "Bedok", "SG"), "Prices show RM (Malaysia), but the area Bedok is in Singapore.");
assert.equal(currencyAreaMismatch("SGD", "Cheras", "MY"), "Prices show S$ (Singapore), but the area Cheras is in Malaysia.");
assert.equal(currencyAreaMismatch("MYR", "Cheras", "MY"), null);
assert.equal(currencyAreaMismatch("SGD", "Bedok", "SG"), null);
assert.equal(currencyAreaMismatch("MYR", "Somewhere", null), null, "unlisted area: no reminder");
assert.equal(currencyAreaMismatch(undefined, "Bedok", "SG"), null);
assert.match(await read("app/merchant/components/currency-setting.tsx"), /currencyAreaMismatch\(currency, area, areaCountry\)/);
assert.match(await read("app/api/admin/restaurant-reviews/route.ts"), /from\('areas'\)\.select\('name, country'\)/);
assert.match(await read("app/admin/components/restaurant-review-queue.tsx"), /currencyAreaMismatch\(item\.currency, item\.snapshot\.area, item\.areaCountry\)/);
console.log("singapore currency checks passed");
