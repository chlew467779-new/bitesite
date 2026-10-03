/**
 * Admin Story submissions (A-02, A-11, A-03): actions per status, the merchant's "Published"
 * label and link, and wiring guards for the Admin card and the merchant page.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { merchantSubmissionLabel, publicStoryPath, submissionActions } from "../lib/story-submission-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const live = { slug: "kopi-story", published: true, editorial_status: "published" };
const draft = { slug: "kopi-story", published: false, editorial_status: "draft" };

// Actions follow the status (A-11).
assert.deepEqual(submissionActions({ status: "pending_review" }), ["approve", "create_draft", "ai_draft", "publish_original", "request_changes", "reject"]);
assert.ok(submissionActions({ status: "pending_review", generated_copy: { content: "x" } }).includes("publish_ai"), "AI publish only after an AI draft");
assert.ok(!submissionActions({ status: "approved" }).includes("approve"), "an approved submission is not approved again");
assert.deepEqual(submissionActions({ status: "converted", article: live }), ["view_story", "edit_story"], "a live Story only offers view and edit");
assert.ok(submissionActions({ status: "converted", article: draft }).includes("publish_original"), "a draft Story can still be published");
assert.ok(!submissionActions({ status: "converted", article: draft }).includes("create_draft"), "no second draft for the same submission");
assert.ok(submissionActions({ status: "converted", article: null }).includes("create_draft"), "a deleted Story can be made again");
assert.deepEqual(submissionActions({ status: "draft" }), ["reject"]);
assert.deepEqual(submissionActions({ status: "rejected" }), []);
assert.deepEqual(submissionActions({ status: "archived" }), []);
assert.deepEqual(submissionActions(null), []);

// Only a public Story has a public address.
assert.equal(publicStoryPath(live), "/stories/kopi-story");
assert.equal(publicStoryPath({ ...live, slug: "咖啡" }), "/stories/%E5%92%96%E5%95%A1");
assert.equal(publicStoryPath(draft), null);
assert.equal(publicStoryPath({ ...live, editorial_status: "approved" }), null);
assert.equal(publicStoryPath(null), null);

// What the owner sees (A-03).
assert.equal(merchantSubmissionLabel("converted", "/stories/kopi-story"), "Published");
assert.equal(merchantSubmissionLabel("converted", null), "With editorial team");
assert.equal(merchantSubmissionLabel("pending_review", "/stories/x"), "Pending review", "a link only counts for a converted submission");
assert.equal(merchantSubmissionLabel("draft", null), "Changes requested");
assert.equal(merchantSubmissionLabel("rejected", null), "Not accepted");

// Wiring.
const adminRoute = await read("app/api/admin/story-submissions/route.ts");
assert.match(adminRoute, /article:articles\(slug, published, editorial_status\)/, "Admin list includes the linked Story state");
const merchantRoute = await read("app/api/merchant/story-submissions/route.ts");
assert.match(merchantRoute, /story_path: item\.status === 'converted' \? publicStoryPath\(/, "owner gets only a public Story address");
assert.match(merchantRoute, /map\(\(\{ article, \.\.\.item \}\)/, "the linked Story row itself is not sent to the owner");
const merchantPage = await read("app/merchant/stories/page.tsx");
assert.match(merchantPage, /merchantSubmissionLabel\(item\.status, item\.story_path\)/);
assert.match(merchantPage, /href=\{item\.story_path\}/);
const card = await read("app/admin/components/story-submissions-manager.tsx");
assert.match(card, /submission\.story_angle &&/, "angle is shown (A-02)");
assert.match(card, /<SubmissionMedia submission=\{submission\}/, "photos are shown as thumbnails (A-02)");
assert.match(card, /const actions = submissionActions\(submission\);/, "buttons follow the status (A-11)");
assert.match(card, /mt-4 flex flex-wrap items-center gap-2/, "the button row wraps on a phone (A-11)");
assert.doesNotMatch(card, /Media: \{submission\.cover_image/, "the old text-only media line is gone");

console.log("Story submission tests passed.");
