/* bitesite/lib/story-review-sync.mjs */

/**
 * What a Story submission review decision does to the article it is linked to.
 *
 * A Story is public only when `published = true` and `editorial_status = 'published'`
 * (private.article_is_public since D1c; the older policy checked `published` alone), so a
 * review decision must keep both columns consistent:
 *
 * - draft / rejected: the article is taken down at once (`published = false`). `published_at`
 *   is left as history.
 * - approved: approval never publishes. An article that is already editorially published stays
 *   exactly as it is, and only the review is recorded; any other article becomes `approved`
 *   and not published.
 * - every other submission status (pending_review, archived, …) leaves the article unchanged.
 *
 * Pure ESM with no dependencies so scripts/test-story-review-sync.mjs can test it directly;
 * story-review-sync.d.mts carries the types.
 */

const REVIEW_TO_EDITORIAL = Object.freeze({ approved: "approved", rejected: "rejected", draft: "draft" });
const REVISION_ACTION = Object.freeze({ approved: "approved", rejected: "rejected", draft: "updated" });

/** The public Story rule, the same one as private.article_is_public. */
export function isArticlePublic(article) {
  return Boolean(article) && article.published === true && article.editorial_status === "published";
}

/**
 * The change a submission status makes to its linked article, or null when the article must
 * not change. `fields` holds only the state columns to write (empty when the state is kept).
 */
export function linkedArticleReviewUpdate(submissionStatus, article) {
  if (!Object.hasOwn(REVIEW_TO_EDITORIAL, submissionStatus) || !article) return null;

  const keepPublished = submissionStatus === "approved" && article.editorial_status === "published";
  const fields = keepPublished ? {} : { editorial_status: REVIEW_TO_EDITORIAL[submissionStatus], published: false };
  const wasPublic = isArticlePublic(article);
  const isPublic = isArticlePublic({ ...article, ...fields });

  return { fields, revisionAction: REVISION_ACTION[submissionStatus], wasPublic, isPublic, visibilityChanged: wasPublic !== isPublic };
}
