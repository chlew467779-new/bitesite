/* bitesite/lib/merchant-context-url.d.mts */

export declare const MERCHANT_PAGE_PARAM: "merchant";
export declare const MERCHANT_API_PARAM: "merchantId";

/** The restaurant selected in a page URL's search string, or null. */
export declare function selectedMerchantIdFromSearch(search: string | null | undefined): string | null;

/** A merchant API path scoped to one restaurant; unchanged when no restaurant is selected. */
export declare function merchantApiUrl(path: string, merchantId: string | null | undefined): string;

/** A Merchant page link that keeps the selected restaurant. */
export declare function merchantPageUrl(path: string, merchantId: string | null | undefined): string;
