/**
 * Area and cuisine landing pages: slugs, grouping, the thin-page rule and wiring.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { discoveryCopy, discoveryGroups, discoveryLanding, discoverySlug, merchantArea, merchantCuisines, MIN_INDEXABLE } from "../lib/discovery-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

assert.equal(discoverySlug("George Town"), "george-town");
assert.equal(discoverySlug("  Bukit Mertajam  "), "bukit-mertajam");
assert.equal(discoverySlug("Café & Bakery"), "cafe-and-bakery");
assert.equal(discoverySlug("Middle Eastern"), "middle-eastern");
assert.equal(discoverySlug("!!!"), "");
assert.equal(discoverySlug("<script>"), "script");

assert.equal(merchantArea({ area: "  George   Town " }), "George Town");
assert.equal(merchantArea({ area: "!!" }), null);
assert.deepEqual(merchantCuisines({ cuisine: ["Malay", "chinese"], cuisine_type: "Chinese" }), ["Malay", "chinese"], "tags first, case duplicates dropped");
assert.deepEqual(merchantCuisines({ cuisine: null, cuisine_type: "Cafe" }), ["Cafe"], "legacy type counts");

const merchants = [
  { id: "1", name: "Kopi B", area: "George Town", cuisine: ["Malay"], cuisine_type: null },
  { id: "2", name: "Kopi A", area: "george town", cuisine: [], cuisine_type: "Cafe" },
  { id: "3", name: "Nasi", area: "George Town", cuisine: ["Malay", "Indian"], cuisine_type: null },
  { id: "4", name: "Solo", area: "Ayer Itam", cuisine: ["Indian"], cuisine_type: null },
  { id: "5", name: "No area", area: null, cuisine: [], cuisine_type: null },
];
const areas = discoveryGroups("area", merchants);
assert.deepEqual(areas.map((g) => [g.slug, g.label, g.count, g.indexable]), [["george-town", "George Town", 3, true], ["ayer-itam", "Ayer Itam", 1, false]], "most common spelling; thin pages not indexable");
assert.equal(MIN_INDEXABLE, 2);
const cuisines = discoveryGroups("cuisine", merchants);
assert.deepEqual(cuisines.map((g) => [g.slug, g.count]), [["indian", 2], ["malay", 2], ["cafe", 1]]);

const landing = discoveryLanding("area", "george-town", merchants);
assert.deepEqual(landing.merchants.map((m) => m.name), ["Kopi A", "Kopi B", "Nasi"], "sorted by name");
assert.equal(landing.indexable, true);
assert.equal(discoveryLanding("area", "nowhere", merchants), null);
assert.equal(discoveryLanding("city", "george-town", merchants), null, "unknown kind");
assert.equal(discoveryLanding("area", "ayer-itam", merchants).indexable, false);
assert.match(discoveryCopy("area", "George Town", 1).description, /^1 place /);
assert.match(discoveryCopy("cuisine", "Malay", 3).title, /^Malay restaurants$/);

const component = await read("app/components/discovery-landing.tsx");
assert.match(component, /getPublishedMerchants\(\)/, "public restaurants only (RLS)");
assert.match(component, /notFound\(\)/);
assert.match(component, /permanentRedirect\(discoveryPath\(kind, canonical\)\)/, "non-canonical slugs redirect");
assert.match(component, /landing\.indexable \? \{ index: true, follow: true \} : \{ index: false, follow: true \}/, "thin pages are noindex");
assert.match(component, /safeJsonLd\(itemList\)/);
assert.match(await read("app/sitemap.ts"), /filter\(\(group\) => group\.indexable\)/, "sitemap lists indexable landing pages only");
assert.match(await read("app/api/track/route.ts"), /'discovery',/);
assert.match(await read("app/store/[merchant]/page.tsx"), /<DiscoveryLinks area=/, "store pages link to their area and cuisine pages");

console.log("discovery checks passed");
