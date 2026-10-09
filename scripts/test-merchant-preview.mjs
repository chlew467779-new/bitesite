/**
 * Private preview (Owner and Admin): wiring guards (authorization, public projection, no
 * analytics, noindex). Checked in the browser: a draft restaurant previews with the status banner,
 * sends no analytics requests, and its public page stays 404.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const lib = await read("app/api/_lib/merchant-preview.ts");
assert.match(lib, /select\(PUBLIC_MERCHANT_SELECT\)/, "the merchant row uses the public projection");
assert.match(lib, /reviews: null/, "legacy reviews never reach the preview");
assert.match(lib, /'Cache-Control': 'no-store'/);
assert.doesNotMatch(lib, /select\('\*'\)/);

const owner = await read("app/api/merchant/preview/route.ts");
assert.match(owner, /requireMerchantAccess\(request, 'read'\)/, "only the restaurant's active Owner");
assert.match(owner, /merchantPreviewResponse\(access\.merchant\.id\)/, "the id comes from the access check, not the request");
const admin = await read("app/api/admin/merchants/[merchantId]/preview/route.ts");
assert.match(admin, /verifyAdminToken\(token\)/, "Admin session");

const page = await read("app/merchant/preview/page.tsx");
assert.match(page, /\{\.\.\.analyticsSuppressedProps\}/, "previews never count as visits or clicks");
assert.doesNotMatch(page, /PageViewTracker|ViewTracker|GrabFoodOrderButton/, "no trackers in the preview");
assert.doesNotMatch(page, /supabase-admin|SERVICE_ROLE/i, "no service role in browser code");
assert.match(page, /<DeliveryOrderButtons links=\{data\.deliveryLinks/, "the preview shows the approved order buttons (T2)");
assert.match(await read("app/api/_lib/merchant-preview.ts"), /merchant_external_links'\)\.select\('link_type, url'\)[^\n]*\.eq\('is_active', true\)/, "only approved delivery links");
assert.match(page, /owner\.preview\.previewOnlyYouCanSeeThis/);
assert.match(JSON.parse(await read("lib/i18n/en.json"))["owner.preview.previewOnlyYouCanSeeThis"], /Preview — only you can see this/);
assert.match(page, /\/api\/admin\/merchants\/\$\{encodeURIComponent\(selected\)\}\/preview/, "Admin preview uses the Admin route");
assert.match(await read("app/merchant/preview/layout.tsx"), /robots: \{ index: false, follow: false \}/);
assert.match(await read("app/merchant/page.tsx"), /merchantPageUrl\('\/merchant\/preview', profile\.id\)/, "dashboard links to the preview");
assert.match(await read("app/admin/components/restaurant-review-queue.tsx"), /&as=admin/, "reviewers can open the preview");

console.log("merchant preview checks passed");
