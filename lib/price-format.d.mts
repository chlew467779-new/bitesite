export type CurrencyCode = "MYR" | "SGD";
export declare const CURRENCIES: readonly { code: CurrencyCode; symbol: string; label: string; country: string }[];
export declare function currencySymbol(currency: string | null | undefined): string;
export declare function formatPrice(value: unknown, currency?: string | null): string;
