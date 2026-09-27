/**
 * P1 Story review state synchronization: behaviour of the shared decision helper plus source
 * wiring guards for the Admin Story submission review route.
 *
 * Behaviour tests exercise lib/story-review-sync.mjs directly. The route itself talks to
 * Supabase and is checked here only at source level (order of writes, cache refresh, revision
 * failure handling); no database is used.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isArticlePublic, linkedArticleReviewUpdate } from "../lib/story-review-sync.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const PUBLISHED = { published: true, editorial_status: "published" };
const APPROVED = { published: false, editorial_status: "approved" };
const PENDING = { published: false, editorial_status: "pending_review" };
const DRAFT = { published: false, editorial_status: "draft" };
// Pre-D1c inconsistency: public under the old `published`-only policy, hidden after D1c.
const FLAG_ONLY = { published: true, editorial_status: "rejected" };

/* ── public rule ───────────────────────────────────────────────────────────────────────────── */

assert.equal(isArticlePublic(PUBLISHED), true);
assert.equal(isArticlePublic(APPROVED), false);
assert.equal(isArticlePublic(FLAG_ONLY), false, "published flag alone is not public");
assert.equal(isArticlePublic({ published: false, editorial_status: "published" }), false);
assert.equal(isArticlePublic({ published: null, editorial_status: "published" }), false);
assert.equal(isArticlePublic(null), false);

/* ── approval never publishes, never demotes ───────────────────────────────────────────────── */

{
  const change = linkedArticleReviewUpdate("approved", PUBLISHED);
  assert.deepEqual(change.fields, {}, "approving a published Story keeps its state");
  assert.equal(change.isPublic, true);
  assert.equal(change.visibilityChanged, false);
  assert.equal(change.revisionAction, "approved", "the approval is still recorded");
}
for (const article of [DRAFT, PENDING, APPROVED, { published: false, editorial_status: "rejected" }]) {
  const change = linkedArticleReviewUpdate("approved", article);
  assert.deepEqual(change.fields, { editorial_status: "approved", published: false }, `approve from ${article.editorial_status}`);
  assert.equal(change.isPublic, false, "approval alone does not publish");
  assert.equal(change.visibilityChanged, false);
}
{
  const change = linkedArticleReviewUpdate("approved", FLAG_ONLY);
  assert.deepEqual(change.fields, { editorial_status: "approved", published: false }, "flag-only public Story is made consistent");
  assert.equal(change.isPublic, false);
}
{
  // editorially published but not flagged: approval must not flip it public
  const change = linkedArticleReviewUpdate("approved", { published: false, editorial_status: "published" });
  assert.deepEqual(change.fields, {});
  assert.equal(change.isPublic, false);
}

/* ── draft / rejected take the Story down ──────────────────────────────────────────────────── */

for (const status of ["draft", "rejected"]) {
  const change = linkedArticleReviewUpdate(status, PUBLISHED);
  assert.deepEqual(change.fields, { editorial_status: status, published: false }, `${status} unpublishes`);
  assert.ok(!("published_at" in change.fields), "published_at is kept as history");
  assert.equal(change.wasPublic, true);
  assert.equal(change.isPublic, false, `${status} leaves no public Story`);
  assert.equal(change.visibilityChanged, true, `${status} of a public Story changes visibility`);

  const flagOnly = linkedArticleReviewUpdate(status, FLAG_ONLY);
  assert.equal(flagOnly.fields.published, false, `${status} clears a stale published flag`);

  const hidden = linkedArticleReviewUpdate(status, DRAFT);
  assert.equal(hidden.isPublic, false);
  assert.equal(hidden.visibilityChanged, false);
}
assert.equal(linkedArticleReviewUpdate("rejected", PUBLISHED).revisionAction, "rejected");
assert.equal(linkedArticleReviewUpdate("draft", PUBLISHED).revisionAction, "updated");

/* ── other statuses leave the article unchanged ────────────────────────────────────────────── */

for (const status of ["pending_review", "archived", "converted", "published", "", "__proto__", "toString"]) {
  assert.equal(linkedArticleReviewUpdate(status, PUBLISHED), null, `${JSON.stringify(status)} does not touch the article`);
}
assert.equal(linkedArticleReviewUpdate("rejected", null), null, "no article, no change");

/* ── route wiring (source level) ───────────────────────────────────────────────────────────── */

const route = await read("app/api/admin/story-submissions/route.ts");
const patch = route.slice(route.indexOf("export async function PATCH"));
const review = patch.slice(patch.indexOf("// Review decision"));

assert.match(route, /from '@\/lib\/story-review-sync\.mjs'/, "route uses the shared decision helper");
assert.match(route, /from '@\/lib\/story-revalidation'/, "route uses the shared public Story revalidation");
assert.doesNotMatch(route, /revalidatePath\(/, "no ad-hoc revalidatePath calls left in the route");
assert.doesNotMatch(review, /editorialStatus = body\.status === 'approved'/, "old inline status mapping is gone");

const articleWrite = review.indexOf("supabase.from('articles')\n          .update(");
const submissionWrite = review.indexOf("supabase.from('story_submissions').update(updateData)");
assert.ok(articleWrite > 0 && submissionWrite > articleWrite, "linked article is written before the submission");
assert.match(review, /\.\.\.change\.fields/, "the article write applies the helper's state fields");
assert.match(review, /\.eq\('editorial_status', current\.editorial_status\)/, "stale review decisions do not overwrite a changed Story");
assert.match(review, /status: 409/, "a changed Story returns 409");

const revalidate = review.indexOf("if (change.visibilityChanged) revalidatePublicStoryRoutes(article.slug)");
const revision = review.indexOf("recordArticleRevision(article, change.revisionAction");
assert.ok(revalidate > articleWrite && revision > revalidate && submissionWrite > revision,
  "cache refresh happens right after the takedown, before the revision and the submission update");

const helper = route.slice(route.indexOf("async function recordArticleRevision"), route.indexOf("export async function GET"));
assert.match(helper, /console\.error\(/, "a revision failure is logged");
assert.doesNotMatch(helper, /NextResponse/, "a revision failure does not end the request");

const publishExisting = patch.slice(patch.indexOf("if (body.publish === true && source.article_id)"), patch.indexOf("const { data: existing }"));
assert.ok(publishExisting.indexOf("revalidatePublicStoryRoutes(article.slug)") < publishExisting.indexOf("recordArticleRevision("),
  "publishing a linked Story refreshes public pages before the revision is recorded");

const revalidation = await read("lib/story-revalidation.ts");
for (const path of ["'/'", "'/stories'", "`/stories/${slug}`", "'/stories/[slug]', 'page'", "'/sitemap.xml'"]) {
  assert.ok(revalidation.includes(`revalidatePath(${path}`), `revalidates ${path}`);
}

console.log("story review sync: all checks passed");
