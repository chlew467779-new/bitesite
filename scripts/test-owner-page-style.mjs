/**
 * Owner page style and sections (issue #11): which settings Owners may write, the dashboard
 * wiring, and the migration's scope. Database: supabase/tests/owner_page_style_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isWritablePath } from "../lib/merchant-field-patch-core.mjs";
import { getPersistableLayouts } from "../lib/layout-registry.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const OPEN = ["hero", "about", "contact", "gallery", "appointment", "seasonal_popup"];

assert.equal(isWritablePath("presentation.layout", "owner"), true);
for (const key of OPEN) assert.equal(isWritablePath(`features.${key}`, "owner"), true, key);
for (const key of ["events", "menu", "reviews"]) assert.equal(isWritablePath(`features.${key}`, "owner"), false, `${key} stays closed`);

const migration = await read("supabase/migrations/20261003150000_owner_page_style.sql");
assert.match(migration, /where \(p_actor_type = 'admin' or r\.kind <> 'feature' or r\.owner_writable\) loop/, "Owners read only the switches they may write");
assert.match(migration, /\('features\.events',\s+'feature', 'events',\s+false, true, null\)/, "events stays closed in the database");

const component = await read("app/merchant/components/page-style-section.tsx");
assert.match(component, /const LAYOUTS = getPersistableLayouts\(\);/, "only production layouts are offered");
for (const key of OPEN) assert.match(component, new RegExp(`key: '${key}'`), `${key} switch offered`);
assert.doesNotMatch(component, /key: 'events'/, "no events switch");
assert.ok(getPersistableLayouts().every((l) => l.productionReady), "persistable = production-ready");
const dashboard = await read("app/merchant/page.tsx");
assert.match(dashboard, /<PageStyleSection key=\{`style:\$\{sectionKey\}`\} \{\.\.\.sectionProps\} \/>/);
const shell = await read("app/merchant/components/dashboard-shell.tsx");
assert.ok(shell.includes("{ id: 'style', title: 'owner.tile.style'"), "listed in the dashboard tiles");

console.log("owner page style checks passed");
