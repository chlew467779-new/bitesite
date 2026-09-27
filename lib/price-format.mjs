/**
 * Display a menu price in ringgit with two decimals ("RM 2.50"). Accepts the numeric values the
 * database returns (number or numeric string); anything else renders as an empty string.
 */
export function formatPrice(value) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  return `RM ${amount.toFixed(2)}`;
}
