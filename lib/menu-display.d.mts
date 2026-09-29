/* bitesite/lib/menu-display.d.mts */

/** Only the fields the display rules need, so preview/fixture data can pass a partial dish. */
export interface PriceVisibilityProduct {
  show_prices?: boolean | null;
  price?: number | string | null;
  discount_price?: number | string | null;
}

/**
 * Whether a dish's price may be shown on a public surface. Only an explicit `false` hides it;
 * null/undefined/missing are treated as visible, preserving historical behaviour.
 */
export declare function shouldShowPrice(product: PriceVisibilityProduct | null | undefined): boolean;

/** Whether a public price container has a numeric value to show. Zero remains visible. */
export declare function hasDisplayablePrice(product: PriceVisibilityProduct | null | undefined): boolean;
