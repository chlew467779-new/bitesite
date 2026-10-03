/**
 * Story submission review (A-02, A-11, A-03): which review actions Admin sees for a submission,
 * and what the restaurant owner is told about it.
 *
 * Statuses: pending_review (new) → approved / draft (changes requested) / rejected, and
 * converted once a Story exists for it. A converted submission's Story may still be a draft;
 * only a public Story (published and editorially published) counts as "Published".
 */

import { isArticlePublic } from "./story-review-sync.mjs";

/** Order is the order of the buttons. */
export const SUBMISSION_ACTIONS = Object.freeze([
  "view_story", "edit_story", "approve", "create_draft", "ai_draft", "publish_original", "publish_ai", "request_changes", "reject",
]);

/**
 * The actions that make sense now. `article` is the linked Story (`{ slug, published,
 * editorial_status }`) or null.
 */
export function submissionActions(submission) {
  const status = submission?.status;
  const article = submission?.article ?? null;
  const hasAi = Boolean(submission?.generated_copy);
  const publishing = ["ai_draft", "publish_original", ...(hasAi ? ["publish_ai"] : [])];
  if (status === "pending_review") return ["approve", "create_draft", ...publishing, "request_changes", "reject"];
  if (status === "approved") return ["create_draft", ...publishing, "request_changes", "reject"];
  if (status === "converted") {
    if (!article) return ["create_draft", ...publishing];
    if (isArticlePublic(article)) return ["view_story", "edit_story"];
    return ["edit_story", ...publishing, "request_changes", "reject"];
  }
  // draft = waiting for the restaurant to change and resubmit; Admin can still close it.
  if (status === "draft") return ["reject"];
  return [];
}

/** The Story's public address, only when the public can see it. */
export function publicStoryPath(article) {
  return isArticlePublic(article) && typeof article.slug === "string" && article.slug ? `/stories/${encodeURIComponent(article.slug)}` : null;
}

const MERCHANT_LABELS = Object.freeze({
  pending_review: "Pending review",
  approved: "Approved",
  draft: "Changes requested",
  rejected: "Not accepted",
  converted: "With editorial team",
  archived: "Archived",
});

/** What the restaurant owner sees: "Published" once the Story is public (`storyPath` from publicStoryPath). */
export function merchantSubmissionLabel(status, storyPath) {
  if (status === "converted" && storyPath) return "Published";
  return MERCHANT_LABELS[status] ?? status;
}
