/**
 * Share previews, icons and photo caching: generated PNG share cards (home + each restaurant),
 * pages that set their own openGraph still name a preview image, icons exist, and every photo
 * upload asks for the one-year cache (file names are UUIDs, so a file never changes).
 */

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { IMMUTABLE_CACHE_SECONDS } from "../lib/media-cache.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const exists = async (relPath) => access(new URL(`../${relPath}`, import.meta.url)).then(() => true, () => false);

assert.equal(IMMUTABLE_CACHE_SECONDS, "31536000");
for (const file of ["app/admin/components/image-upload.tsx", "app/components/media/profile-image-field.tsx", "app/merchant/stories/page.tsx"]) {
  const source = await read(file);
  assert.match(source, /uploadToSignedUrl\([^;]*cacheControl: IMMUTABLE_CACHE_SECONDS/, `${file}: uploads are cached for a year`);
}

for (const file of ["app/opengraph-image.tsx", "app/store/[merchant]/opengraph-image.tsx", "app/icon.tsx", "app/apple-icon.tsx"]) {
  assert.ok(await exists(file), `${file} exists`);
}
const storeCard = await read("app/store/[merchant]/opengraph-image.tsx");
assert.match(storeCard, /export const contentType = "image\/png";/, "share cards are PNG (WhatsApp shows them reliably; covers are WebP)");
assert.match(storeCard, /getMerchantBySlug\(slug\)/, "only public restaurants are read (row level security)");
const storePage = await read("app/store/[merchant]/page.tsx");
assert.doesNotMatch(storePage, /images: ogImage/, "the store page does not override the generated card with the WebP cover");

for (const file of ["app/join-us/page.tsx", "app/components/discovery-landing.tsx"]) {
  assert.match(await read(file), /images: \[["']\/opengraph-image["']\]/, `${file}: keeps a preview image`);
}
assert.match(await read("app/stories/[slug]/page.tsx"), /images: ogImage \? \[\{ url: ogImage \}\] : \["\/opengraph-image"\]/, "a Story without a cover uses the default card");
assert.match(await read("app/stories/[slug]/page.tsx"), /url: `\$\{siteUrl\}\/apple-icon`/, "structured-data logo points to a real image");

const brand = await read("lib/og-brand.tsx");
assert.match(brand, /fonts\.push\(\{ name: "Body"/, "body text has its own font, so subset fonts never lend glyphs");
assert.match(brand, /return response\.ok \? await response\.arrayBuffer\(\) : null;/, "a font that cannot load falls back instead of failing");

console.log("share preview checks passed");
