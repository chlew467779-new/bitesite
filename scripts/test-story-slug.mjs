/**
 * Story web addresses (A-01): new slugs use English letters and numbers only, so analytics and the
 * Story page accept them; older Chinese slugs still open because the page decodes its address.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodeStorySlugParam, isValidStorySlug, makeStorySlug, storySlugBase } from "../lib/story-slug-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const NOW = new Date("2026-10-03T08:00:00Z");
const TRACK_PATTERN = /^[a-z0-9-]{1,200}$/;

for (const [title, slug] of [
  ["Nasi Lemak Story", "nasi-lemak-story"],
  ["  Kopi & Kaya!! ", "kopi-kaya"],
  ["Café Crème", "cafe-creme"],
  ["阿成咖啡店 Kopi Ah Seng", "kopi-ah-seng"],
  ["阿成咖啡店的故事", "story-20261003"],
  ["2026 新店开张", "2026"],
  ["", "story-20261003"],
  ["!!!", "story-20261003"],
]) {
  const base = storySlugBase(title, NOW);
  assert.equal(base, slug, title);
  assert.ok(isValidStorySlug(base), `${title} gives a valid slug`);
  assert.ok(TRACK_PATTERN.test(base), `${title} is accepted by /api/track and /api/story-view`);
  assert.equal(encodeURIComponent(base), base, "the address does not change when encoded");
}

const long = storySlugBase(`${"word ".repeat(30)}end`, NOW);
assert.ok(long.length <= 50 && isValidStorySlug(long), "long titles are cut without a trailing hyphen");

assert.equal(makeStorySlug("Kopi Story", ["other"], NOW), "kopi-story");
assert.equal(makeStorySlug("Kopi Story", ["kopi-story", "kopi-story-1"], NOW), "kopi-story-2");
assert.equal(makeStorySlug("咖啡", ["story-20261003"], NOW), "story-20261003-1");

for (const [value, ok] of [["kopi-story", true], ["a", true], ["Kopi", false], ["kopi--story", false], ["-kopi", false], ["kopi story", false], ["咖啡", false], ["a".repeat(61), false]]) {
  assert.equal(isValidStorySlug(value), ok, value);
}

assert.equal(decodeStorySlugParam("%E5%92%96%E5%95%A1-story"), "咖啡-story", "encoded legacy slugs are decoded");
assert.equal(decodeStorySlugParam("咖啡-story"), "咖啡-story", "already decoded slugs stay the same");
assert.equal(decodeStorySlugParam("kopi-story"), "kopi-story");
assert.equal(decodeStorySlugParam("bad-%E5"), "bad-%E5", "broken encoding is kept as is");
assert.equal(decodeStorySlugParam(undefined), "");

// Wiring: every place that creates a Story address uses the shared rule; the page decodes.
const adminStories = await read("app/api/admin/stories/route.ts");
assert.match(adminStories, /makeStorySlug\(body\.title, existingSlugs\)/);
assert.match(adminStories, /isValidStorySlug\(requestedSlug\)/, "a typed address is checked on the server");
const submissions = await read("app/api/admin/story-submissions/route.ts");
assert.match(submissions, /makeStorySlug\(source\.title,/);
assert.doesNotMatch(submissions, /\\u4e00/, "no Chinese characters in new slugs");
const editor = await read("app/admin/components/story-editor.tsx");
assert.match(editor, /storySlugBase\(form\.title\)/);
assert.match(editor, /!slug && !isValidStorySlug\(form\.slug\)/, "only new Stories must follow the rule");
const page = await read("app/stories/[slug]/page.tsx");
assert.equal(page.match(/const slug = decodeStorySlugParam\(rawSlug\);/g)?.length, 2, "metadata and page both decode");

console.log("Story slug tests passed.");
