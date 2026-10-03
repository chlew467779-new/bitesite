/**
 * Owner amenities / occasion (issue #4): Owners may write both tags, the dashboard limits match the
 * registry, and every public layout shows them. Database: supabase/tests/owner_amenities_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MERCHANT_FIELD_REGISTRY, isWritablePath } from "../lib/merchant-field-patch-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

assert.equal(isWritablePath("tags.amenities", "owner"), true);
assert.equal(isWritablePath("tags.occasion", "owner"), true);
assert.equal(isWritablePath("presentation.layout", "owner"), false, "layout stays Admin-only");
const max = (path) => MERCHANT_FIELD_REGISTRY.find((row) => row.path === path).maxLength;
assert.equal(max("tags.amenities"), 5);
assert.equal(max("tags.occasion"), 3);

const migration = await read("supabase/migrations/20261003140000_owner_amenities_occasion.sql");
assert.match(migration, /\('tags\.amenities',\s+'tag_array', 'amenities', true,\s+true, 5\)/);
assert.match(migration, /\('tags\.occasion',\s+'tag_array', 'occasion',\s+true,\s+true, 3\)/);

const section = await read("app/merchant/components/amenities-section.tsx");
assert.match(section, /path: 'tags\.amenities'.*max: 5/, "dashboard limit = registry (5 facilities)");
assert.match(section, /path: 'tags\.occasion'.*max: 3/, "dashboard limit = registry (3 occasions)");
assert.match(section, /chosen\.filter\(\(t\) => !group\.options\.includes\(t\)\)/, "older values stay visible");
const dashboard = await read("app/merchant/page.tsx");
assert.match(dashboard, /<AmenitiesSection key=\{`amenities:\$\{sectionKey\}`\} \{\.\.\.sectionProps\} \/>/);

for (const name of ["chinese", "classic", "elegant", "malay", "minimal", "modern", "rustic"]) {
  const layout = await read(`app/layouts/${name}-layout.tsx`);
  assert.match(layout, /<ListingTags amenities=\{merchant\.amenities\} occasion=\{merchant\.occasion\}/, `${name} shows facilities and occasions`);
}
const projection = await read("lib/public-merchant-projection.mjs");
assert.match(projection, /"amenities",\n\s+"occasion",/, "both are public columns");

console.log("owner amenities checks passed");
