/**
 * Owner private preview: wiring guards (Owner-only API, public projection, no analytics, noindex).
 * Checked in the browser: a draft restaurant previews with the status banner, sends no analytics
 * requests, and its public page stays 404.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const api = await read("app/api/merchant/preview/route.ts");
assert.match(api, /requireMerchantAccess\(request, 'read'\)/, "only the restaurant's active Owner");
assert.match(api, /select\(PUBLIC_MERCHANT_SELECT\)/, "the merchant row uses the public projection");
assert.match(api, /reviews: null/, "legacy reviews never reach the preview");
assert.match(api, /'Cache-Control': 'no-store'/);
assert.doesNotMatch(api, /select\('\*'\)/);

const page = await read("app/merchant/preview/page.tsx");
assert.match(page, /\{\.\.\.analyticsSuppressedProps\}/, "previews never count as visits or clicks");
assert.doesNotMatch(page, /PageViewTracker|ViewTracker|GrabFoodOrderButton/, "no trackers in the preview");
assert.doesNotMatch(page, /supabase-admin|SERVICE_ROLE/i, "no service role in browser code");
assert.match(page, /Preview — only you can see this/);
assert.match(await read("app/merchant/preview/layout.tsx"), /robots: \{ index: false, follow: false \}/);
assert.match(await read("app/merchant/page.tsx"), /merchantPageUrl\('\/merchant\/preview', profile\.id\)/, "dashboard links to the preview");

console.log("merchant preview checks passed");
