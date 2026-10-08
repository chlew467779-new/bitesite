/**
 * Search-engine settings that are product decisions rather than data.
 *
 * Sample listings (shown to restaurant owners as an example) are not real restaurants: they stay
 * on the site for visitors but are kept out of Google and the sitemap, so search results only
 * lead to real places.
 */
export const NOINDEX_STORE_SLUGS = Object.freeze(["kopipagi"]);

export function isNoindexStore(slug) {
  return NOINDEX_STORE_SLUGS.includes(String(slug ?? "").toLowerCase());
}
