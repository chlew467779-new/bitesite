/* bitesite/lib/public-article-projection.d.mts */

/** Story columns readable by the public database roles (see public-article-projection.mjs). */
export declare const PUBLIC_ARTICLE_COLUMNS: readonly [
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
];

/** PUBLIC_ARTICLE_COLUMNS joined for a PostgREST select. */
export declare const PUBLIC_ARTICLE_SELECT: string;
