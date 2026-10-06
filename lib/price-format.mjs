/**
 * Display a menu price with two decimals in the restaurant's currency: "RM 2.50" (MYR, the
 * default) or "S$ 2.50" (SGD, Singapore restaurants). Accepts the numeric values the database
 * returns (number or numeric string); anything else renders as an empty string. An unknown or
 * missing currency shows RM, as before Singapore (#24).
 */
export const CURRENCIES = Object.freeze([
  { code: "MYR", symbol: "RM", label: "Malaysian ringgit (RM)", country: "Malaysia", countryCode: "MY" },
  { code: "SGD", symbol: "S$", label: "Singapore dollar (S$)", country: "Singapore", countryCode: "SG" },
]);

/**
 * T6: the currency and the area's country disagree (RM with a Singapore area, or S$ with a
 * Malaysian one). Null when they agree or either is unknown; otherwise a short sentence for the
 * Owner dashboard and the Admin review page. A warning only: neither value is refused.
 */
export function currencyAreaMismatch(currency, areaName, areaCountry) {
  const money = CURRENCIES.find((c) => c.code === currency);
  const place = CURRENCIES.find((c) => c.countryCode === areaCountry);
  if (!money || !place || money.code === place.code) return null;
  return `Prices show ${money.symbol} (${money.country}), but the area${areaName ? ` ${areaName}` : ""} is in ${place.country}.`;
}

export function currencySymbol(currency) {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? "RM";
}

export function formatPrice(value, currency) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  return `${currencySymbol(currency)} ${amount.toFixed(2)}`;
}
