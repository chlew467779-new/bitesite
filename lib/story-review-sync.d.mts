/* bitesite/lib/story-review-sync.d.mts */

export interface ArticleReviewState {
  published: boolean | null;
  editorial_status: string | null;
}

export interface LinkedArticleReviewUpdate {
  /** State columns to write; empty when an already published article is approved. */
  fields: { editorial_status?: "approved" | "rejected" | "draft"; published?: false };
  revisionAction: "approved" | "rejected" | "updated";
  wasPublic: boolean;
  isPublic: boolean;
  visibilityChanged: boolean;
}

/** Whether a Story may be shown publicly: published and editorially published. */
export declare function isArticlePublic(article: ArticleReviewState | null | undefined): boolean;

/**
 * The change a submission review status makes to its linked article, or null when the article
 * must not change (statuses other than approved / rejected / draft, or no article).
 */
export declare function linkedArticleReviewUpdate(
  submissionStatus: string,
  article: ArticleReviewState | null | undefined,
): LinkedArticleReviewUpdate | null;
