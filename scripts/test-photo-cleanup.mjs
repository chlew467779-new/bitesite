/**
 * Photo cleanup (C6): only old, unreferenced files in the public photo buckets are offered, the
 * delete body is strict, and the route re-checks before deleting and refuses on any read error.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CLEANUP_BUCKETS, MAX_DELETE_PER_RUN, MIN_AGE_DAYS, REFERENCE_SOURCES, findUnusedPhotos, formatBytes, parseCleanupDelete } from "../lib/photo-cleanup-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const NOW = Date.UTC(2026, 9, 4);
const old = new Date(NOW - 40 * 86_400_000).toISOString();
const recent = new Date(NOW - 5 * 86_400_000).toISOString();
const obj = (path, createdAt = old, bucket = "merchant-media") => ({ bucket, path, size: 1000, createdAt });

assert.deepEqual(CLEANUP_BUCKETS, ["merchant-media", "story-media"], "private menu-photos bucket never included");
assert.equal(MIN_AGE_DAYS, 30);

const objects = [
  obj("profile/m1/logo/aaa.webp"),                       // used by a merchant (JSON-escaped slashes)
  obj("profile/m1/cover/bbb.webp"),                      // unused, old -> offered
  obj("dish/m1/p1/ccc.webp", recent),                     // unused but recent -> kept
  obj("admin/ddd.jpg", old, "story-media"),               // used inside Story HTML
  obj("admin/eee.jpg", old, "story-media"),               // unused -> offered
  obj("profile/.emptyFolderPlaceholder"),                 // placeholder -> never
  obj("x/fff.png", old, "menu-photos"),                   // other bucket -> never
  obj("profile/m1/logo/ggg.webp", "not a date"),          // unknown age -> kept
];
const refs = JSON.stringify([{ logo_image: "https://x.supabase.co/storage/v1/object/public/merchant-media/profile/m1/logo/aaa.webp" }]).replace(/\//g, "\\/")
  + JSON.stringify([{ content: '<p><img src="https://x.supabase.co/storage/v1/object/public/story-media/admin/ddd.jpg"></p>' }]);
const unused = findUnusedPhotos(objects, refs, NOW);
assert.deepEqual(unused.map((o) => `${o.bucket}/${o.path}`).sort(), ["merchant-media/profile/m1/cover/bbb.webp", "story-media/admin/eee.jpg"]);
assert.equal(findUnusedPhotos(objects, refs + "profile/m1/cover/bbb.webp", NOW).length, 1, "a mention anywhere keeps the file");

/* Delete body */
assert.equal(parseCleanupDelete({ items: [{ bucket: "merchant-media", path: "profile/m1/cover/bbb.webp" }, { bucket: "merchant-media", path: "profile/m1/cover/bbb.webp" }] }).items.length, 1, "duplicates collapse");
assert.equal(parseCleanupDelete({ items: [{ bucket: "menu-photos", path: "a.jpg" }] }).ok, false, "private bucket refused");
assert.equal(parseCleanupDelete({ items: [{ bucket: "merchant-media", path: "../x.jpg" }] }).ok, false);
assert.equal(parseCleanupDelete({ items: [{ bucket: "merchant-media", path: "/x.jpg" }] }).ok, false);
assert.equal(parseCleanupDelete({ items: [] }).ok, false);
assert.equal(parseCleanupDelete({ items: Array.from({ length: MAX_DELETE_PER_RUN + 1 }, (_, i) => ({ bucket: "merchant-media", path: `a/${i}.jpg` })) }).ok, false);
assert.equal(parseCleanupDelete({ items: [{ bucket: "merchant-media", path: "a.jpg" }], all: true }).ok, false);
assert.equal(formatBytes(1536), "2 KB");

/* Every column that can show a photo is read (columns exist in the migrations). */
const sources = Object.fromEntries(REFERENCE_SOURCES.map((s) => [s.table, s.columns]));
for (const [table, column] of [["merchants", "logo_image"], ["merchants", "cover_image"], ["products", "image_url"], ["articles", "content"], ["articles", "cover_image"], ["story_submissions", "image_urls"], ["events", "image_url"], ["site_announcements", "image_url"]]) {
  assert.ok(sources[table]?.includes(column), `${table}.${column} is checked`);
}

/* Route: Admin only, re-checks before delete, refuses on read errors, uses the Storage API. */
const route = await read("app/api/admin/photo-cleanup/route.ts");
assert.match(route, /verifyAdminToken\(token\)/);
assert.match(route, /if \(error\) throw new ScanError/);
assert.match(route, /stillUnused = new Set\(\(await scan\(\)\)\.unused/);
assert.match(route, /\.filter\(\(i\) => stillUnused\.has/);
assert.match(route, /storage\.from\(bucket\)\.remove\(/);
assert.match(await read("app/admin/page.tsx"), /activeTab === 'photo-cleanup' && <PhotoCleanup \/>/);

console.log("photo cleanup checks passed");
