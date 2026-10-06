export type CurrencyCode = "MYR" | "SGD";
export declare const CURRENCIES: readonly { code: CurrencyCode; symbol: string; label: string; country: string; countryCode: "MY" | "SG" }[];
export declare function currencyAreaMismatch(currency: string | null | undefined, areaName: string | null | undefined, areaCountry: string | null | undefined): string | null;
export declare function currencySymbol(currency: string | null | undefined): string;
export declare function formatPrice(value: unknown, currency?: string | null): string;
