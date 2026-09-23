/**
 * Shared menu display rules for public surfaces.
 *
 * Kept as a small ESM module (same convention as lib/safe-json-ld.mjs and
 * lib/layout-registry.mjs) so scripts/test-show-prices.mjs can execute the exact rule the
 * layouts use. CI runs Node 20 and cannot execute TypeScript directly; menu-display.d.mts
 * carries the types.
 */

/**
 * Whether a dish's price may be shown on a public surface.
 *
 * Only an explicit `false` hides prices. `null`/`undefined`/a missing field are treated as true,
 * which preserves the behaviour of every row written before the column was honoured anywhere.
 *
 * When this returns false, nothing price-related renders: regular price, discount price, the
 * strikethrough original and the currency symbol all disappear, and no empty price container is
 * left behind. Name, description, image, featured and availability are unaffected — hiding a
 * price says nothing about whether the dish can be ordered.
 */
export function shouldShowPrice(product) {
  return product?.show_prices !== false;
}
