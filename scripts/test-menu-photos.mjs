/**
 * Menu photos from restaurant owners: names and paths, request parsing, storage listing helpers,
 * the "menu added" notice, and wiring guards (private bucket, Owner-only route, server checks the
 * file before it counts). Database: supabase/tests/menu_photos_bucket_assertions.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MENU_PHOTO_MAX_COUNT, checkedPhotos, contentTypeOfName, incomingPath, isMenuPhotoName, isMissingBucketError,
  merchantFolders, newMenuPhotoName, parseMenuPhotoRequest, photoPath,
} from "../lib/menu-photos-core.mjs";
import { noticeMessage } from "../lib/whatsapp-notify-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const U = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a1";
const M = "00000000-0000-4000-8000-0000000A0001";

assert.equal(newMenuPhotoName("image/jpeg", U), `${U}.jpg`);
assert.equal(newMenuPhotoName("image/webp", U), `${U}.webp`);
assert.equal(newMenuPhotoName("image/gif", U), null, "only JPEG, PNG, WebP");
assert.equal(newMenuPhotoName("image/jpeg", "../x"), null);
assert.equal(incomingPath(M, `${U}.jpg`), `00000000-0000-4000-8000-0000000a0001/incoming/${U}.jpg`, "lower-case folder");
assert.equal(photoPath(M, `${U}.jpg`), `00000000-0000-4000-8000-0000000a0001/${U}.jpg`);
assert.equal(contentTypeOfName(`${U}.png`), "image/png");
for (const [name, ok] of [[`${U}.jpg`, true], [`${U}.JPG`, false], [`../${U}.jpg`, false], [`incoming/${U}.jpg`, false], [`${U}.jpg.exe`, false], ["x.jpg", false], [null, false]]) {
  assert.equal(isMenuPhotoName(name), ok, String(name));
}

assert.deepEqual(parseMenuPhotoRequest({ action: "ticket", contentType: "image/jpeg" }), { ok: true, action: "ticket", contentType: "image/jpeg" });
assert.equal(parseMenuPhotoRequest({ action: "ticket", contentType: "image/svg+xml" }).ok, false);
assert.equal(parseMenuPhotoRequest({ action: "ticket", contentType: "image/jpeg", path: "x" }).ok, false, "no client-chosen path");
assert.deepEqual(parseMenuPhotoRequest({ action: "confirm", name: `${U}.jpg` }), { ok: true, action: "confirm", name: `${U}.jpg` });
assert.equal(parseMenuPhotoRequest({ action: "confirm", name: `../other/${U}.jpg` }).ok, false);
assert.equal(parseMenuPhotoRequest({ action: "confirm", name: `${U}.jpg`, merchantId: M }).ok, false, "no extra keys");
assert.equal(parseMenuPhotoRequest({ action: "delete" }).ok, false);
assert.equal(parseMenuPhotoRequest(null).ok, false);

const listing = [
  { name: "incoming", id: null },
  { name: `${U}.jpg`, id: "a", created_at: "2026-10-03T10:00:00Z", metadata: { size: 1200 } },
  { name: "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a2.png", id: "b", created_at: "2026-10-03T09:00:00Z", metadata: { size: 900 } },
  { name: "notes.txt", id: "c", created_at: "2026-10-03T08:00:00Z" },
];
assert.deepEqual(checkedPhotos(listing).map((p) => p.name), ["7d1c3a52-5b1e-4c8e-9a51-0e2c55d2f1a2.png", `${U}.jpg`], "oldest first; folders and stray files left out");
assert.deepEqual(merchantFolders([{ name: "00000000-0000-4000-8000-0000000a0001", id: null }, { name: "stray.jpg", id: "x" }, { name: "not-a-merchant", id: null }]), ["00000000-0000-4000-8000-0000000a0001"]);
assert.equal(isMissingBucketError({ message: "Bucket not found", code: "NoSuchBucket" }), true);
assert.equal(isMissingBucketError({ message: "The related resource does not exist", code: "InvalidRequest" }), false);
assert.equal(isMissingBucketError({ message: "The resource was not found" }), false);
assert.equal(MENU_PHOTO_MAX_COUNT, 12);

const done = noticeMessage("menu_added", { name: "Kopi Ah Seng", slug: "kopi-ah-seng", site: "https://bitesite.example" });
assert.equal(done.subject, "Your menu is on BiteSite");
assert.ok(done.text.includes("https://bitesite.example/store/kopi-ah-seng") && done.text.includes("https://bitesite.example/merchant"));

// Wiring.
const migration = await read("supabase/migrations/20261003130000_menu_photos_bucket.sql");
assert.match(migration, /values \('menu-photos', 'menu-photos', false, 10485760/, "private bucket, 10 MB");
assert.doesNotMatch(migration, /create policy/i, "no storage policy opens the bucket");
const owner = await read("app/api/merchant/restaurants/[merchantId]/menu-photos/route.ts");
assert.match(owner, /resolveMerchantAccess\(\{ merchants: owned\.merchants, requestedMerchantId: merchantId, capability \}\)/, "only the caller's own restaurant");
assert.match(owner, /ownerAccess\(request, \(await params\)\.merchantId, 'write'\)/, "uploads and deletes need write access");
const helper = await read("app/api/_lib/menu-photos.ts");
assert.match(helper, /^import 'server-only';/m);
assert.match(helper, /sniffImageType\(bytes\) !== contentTypeOfName\(name\)/, "the real file type is checked before a photo counts");
assert.match(helper, /createSignedUploadUrl\(path\)/);
assert.doesNotMatch(helper, /getPublicUrl/, "menu photos never get a public URL");
assert.ok(helper.includes("storage.getBucket(MENU_PHOTOS_BUCKET)"), "the bucket is checked explicitly (list() hides a missing bucket)");
assert.ok(helper.includes("data?.public !== false"), "a public bucket is refused");
assert.equal(helper.split("const ready = await ensureBucket();").length - 1, 5, "every operation checks the bucket first");
const admin = await read("app/api/admin/menu-photos/route.ts");
assert.match(admin, /verifyAdminToken\(token\)/, "Admin only");
const attention = await read("app/api/admin/attention/route.ts");
assert.match(attention, /'menu-photos': menuPhotos\.ok \? menuPhotos\.value\.length : 0/, "badge works before the bucket exists");
const dashboard = await read("app/merchant/page.tsx");
assert.match(dashboard, /<MenuPhotosPanel key=/);
const panel = await read("app/merchant/components/menu-photos-panel.tsx");
assert.match(panel, /if \(r\.status === 503\) \{ setHidden\(true\); return; \}/, "hidden until the bucket exists");
assert.match(panel, /uploadToSignedUrl\(/);
const queue = await read("app/admin/components/menu-photos-queue.tsx");
assert.match(queue, /kind: 'menu_added'/);

console.log("menu photo checks passed");
