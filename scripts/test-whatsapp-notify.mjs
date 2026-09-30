import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mailLink, noticeMessage, NOTICE_KINDS, waLink } from "../lib/whatsapp-notify-core.mjs";

assert.equal(waLink("+60123456789", "hi"), "https://wa.me/60123456789?text=hi");
assert.equal(waLink("012-345 6789", "hi"), "https://wa.me/60123456789?text=hi", "local number gets 60");
assert.equal(waLink("+60 3-1234 5678", "a b"), "https://wa.me/60312345678?text=a%20b", "landline kept; text encoded");
assert.equal(waLink("+6591234567", "x"), "https://wa.me/6591234567?text=x", "Singapore");
assert.equal(waLink("12345", "x"), null);
assert.equal(waLink(null, "x"), null);
assert.equal(waLink("+44 20 7946 0958", "x"), null, "only MY/SG");

assert.equal(mailLink("a@b.my", "S", "T"), "mailto:a@b.my?subject=S&body=T");
assert.equal(mailLink("not-an-email", "S", "T"), null);

const site = "https://bitesite.example";
for (const kind of NOTICE_KINDS) {
  const m = noticeMessage(kind, { name: "Kopi Ah Seng", note: "Add a menu photo.", slug: "kopi-ah-seng", site });
  assert.ok(m.text.startsWith("Hi Kopi Ah Seng,"), kind);
  assert.ok(m.subject.length > 0, kind);
  if (kind.endsWith("rejected") || kind === "story_changes") assert.ok(m.text.includes("Add a menu photo."), `${kind} carries the reason`);
}
assert.ok(noticeMessage("review_approved", { name: "X", site }).text.includes(`${site}/merchant`));
assert.ok(noticeMessage("link_approved", { name: "X", slug: "x-cafe", site }).text.includes(`${site}/store/x-cafe`));
assert.ok(!noticeMessage("review_rejected", { name: "X", note: null, site }).text.includes("null"), "no reason → no 'null'");
assert.ok(noticeMessage("story_published", { name: "X", storySlug: "story-20261003", site }).text.includes(`${site}/stories/story-20261003`), "published Story link");
assert.ok(noticeMessage("story_published", { name: "X", storySlug: "咖啡", site }).text.includes(`${site}/stories/%E5%92%96%E5%95%A1`), "older Chinese address is encoded");

// Wiring: every review queue offers the notice after a decision.
const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
for (const file of ["restaurant-review-queue", "basics-review-queue", "link-review-queue", "story-submissions-manager"]) {
  const src = await read(`app/admin/components/${file}.tsx`);
  assert.match(src, /<NotifyMerchant notices=\{notices\}/, `${file} shows notices`);
  assert.match(src, /addNotice\(\{/, `${file} adds a notice after a decision`);
}
const stories = await read("app/admin/components/story-submissions-manager.tsx");
assert.match(stories, /kind && submission\.merchant_id/, "relayed Stories without a restaurant get no notice");
const contact = await read("app/api/admin/merchant-contact/route.ts");
assert.match(contact, /verifyAdminToken\(token\)/, "contact route is Admin-only");

console.log("whatsapp notify checks passed");
