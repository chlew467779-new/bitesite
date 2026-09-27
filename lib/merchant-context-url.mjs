/* bitesite/lib/merchant-context-url.mjs */

/**
 * Browser-side merchant context for the Merchant pages (master spec §4.3). The selected
 * restaurant is carried in the page URL (`?merchant=<id>`) and sent to every merchant API as
 * `?merchantId=<id>`; the server still decides whether the account owns it. Pure ESM so
 * scripts/test-merchant-access.mjs can test it; merchant-context-url.d.mts carries the types.
 */

export const MERCHANT_PAGE_PARAM = "merchant";
export const MERCHANT_API_PARAM = "merchantId";

/** The restaurant selected in a page URL's search string, or null. */
export function selectedMerchantIdFromSearch(search) {
  if (typeof search !== "string") return null;
  const value = new URLSearchParams(search).get(MERCHANT_PAGE_PARAM);
  const trimmed = value ? value.trim() : "";
  return trimmed || null;
}

function withParam(path, name, value) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${name}=${encodeURIComponent(value)}`;
}

/** A merchant API path scoped to one restaurant; unchanged when no restaurant is selected. */
export function merchantApiUrl(path, merchantId) {
  return merchantId ? withParam(path, MERCHANT_API_PARAM, merchantId) : path;
}

/** A Merchant page link that keeps the selected restaurant. */
export function merchantPageUrl(path, merchantId) {
  return merchantId ? withParam(path, MERCHANT_PAGE_PARAM, merchantId) : path;
}
