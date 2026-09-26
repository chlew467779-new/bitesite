/**
 * The Story (articles) columns the public (anon / authenticated) database role may read.
 *
 * Same convention as lib/public-merchant-projection.mjs: an ESM module so
 * scripts/test-article-public-projection.mjs can compare it with the migration that grants the
 * columns; public-article-projection.d.mts carries the types.
 *
 * Since D1c the database grants SELECT on exactly these columns
 * (supabase/migrations/20260926112649_article_public_projection.sql). Review notes, reviewer,
 * rights declaration, AI draft copy, editorial status, the published flag and view counts are
 * readable only by server code using the service role. A public read that asks for another
 * column, uses select("*"), or filters on published / editorial_status fails with
 * "permission denied".
 *
 * Which Stories are visible is decided by row level security (private.article_is_public), not
 * by a filter in the query.
 */

export const PUBLIC_ARTICLE_COLUMNS = Object.freeze([
  "id",
  "slug",
  "title",
  "excerpt",
  "content",
  "cover_image",
  "category",
  "tags",
  "merchant_slug",
  "author",
  "background_style",
  "published_at",
  "end_at",
  "created_at",
  "updated_at",
]);

/** The PostgREST select string for a full public Story row. */
export const PUBLIC_ARTICLE_SELECT = PUBLIC_ARTICLE_COLUMNS.join(",");
