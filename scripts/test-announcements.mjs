import assert from "node:assert/strict";
import { isAnnouncementLink, isAnnouncementLive, parseAnnouncement } from "../lib/announcement-core.mjs";

const ok = parseAnnouncement({ title: "  Merdeka promo  ", body: "Free kopi", imageUrl: "https://x.supabase.co/a.webp", linkUrl: "/join-us", linkLabel: "Join", isActive: true });
assert.equal(ok.ok, true, "valid form");
assert.equal(ok.row.title, "Merdeka promo", "trimmed");
assert.equal(ok.row.is_active, true);
assert.equal(ok.row.link_url, "/join-us");

assert.equal(parseAnnouncement({ imageUrl: "https://x/a.webp" }).ok, true, "image only");
assert.equal(parseAnnouncement({ body: "text only" }).ok, false, "needs a title or an image");
assert.equal(parseAnnouncement({ title: "a".repeat(81) }).ok, false, "title too long");
assert.equal(parseAnnouncement({ title: "t", linkUrl: "/x" }).ok, false, "link without label");
assert.equal(parseAnnouncement({ title: "t", linkUrl: "javascript:alert(1)", linkLabel: "Go" }).ok, false, "javascript link refused");
assert.equal(parseAnnouncement({ title: "t", linkUrl: "//evil.com", linkLabel: "Go" }).ok, false, "protocol-relative refused");
assert.equal(parseAnnouncement({ title: "t", linkUrl: "http://plain.com", linkLabel: "Go" }).ok, false, "http refused");
assert.equal(parseAnnouncement({ title: "t", imageUrl: "data:image/png;base64,xx" }).ok, false, "data image refused");
assert.equal(parseAnnouncement({ title: "t", startsAt: "2026-10-02T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" }).ok, false, "end before start");
assert.equal(parseAnnouncement({ title: "t", extra: 1 }).ok, false, "unknown field");
assert.equal(parseAnnouncement({ title: "t", isActive: "yes" }).ok, false, "bad on/off");

assert.equal(isAnnouncementLink("/"), true);
assert.equal(isAnnouncementLink("https://bitesite.my/x"), true);
assert.equal(isAnnouncementLink("mailto:a@b.c"), false);

const now = new Date("2026-10-01T12:00:00Z");
assert.equal(isAnnouncementLive({ is_active: true, starts_at: null, ends_at: null }, now), true, "no window");
assert.equal(isAnnouncementLive({ is_active: false, starts_at: null, ends_at: null }, now), false, "off");
assert.equal(isAnnouncementLive({ is_active: true, starts_at: "2026-10-02T00:00:00Z", ends_at: null }, now), false, "not started");
assert.equal(isAnnouncementLive({ is_active: true, starts_at: null, ends_at: "2026-10-01T11:00:00Z" }, now), false, "ended");

console.log("announcement checks passed");
