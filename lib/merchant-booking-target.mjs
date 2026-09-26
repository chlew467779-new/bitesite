/**
 * Where a public "Book a Table" request may be sent.
 *
 * Kept as a small ESM module (same convention as lib/menu-display.mjs) so
 * scripts/test-merchant-booking-safety.mjs can execute the exact rule the storefront uses.
 * merchant-booking-target.d.mts carries the types.
 *
 * The only valid destination is the restaurant's own WhatsApp number. There is deliberately no
 * fallback: not to the restaurant's ordinary phone number, and not to any platform number. A
 * booking form that cannot reach the restaurant is not rendered at all.
 *
 * Passing this check proves only that the value is shaped like an international WhatsApp
 * number. It does not prove the number exists or belongs to the restaurant.
 */

/** Readable separators a merchant may type between digits. Letters are never "cleaned away". */
const ALLOWED_CHARS = /^\+?[\d\s\-.()]+$/;
const DIGITS = /^[1-9]\d{7,14}$/;

/**
 * Normalise a stored WhatsApp value to the digits wa.me expects, or null when it is not a
 * usable international number (8–15 digits, country code first, so no leading 0).
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeBookingWhatsApp(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !ALLOWED_CHARS.test(trimmed)) return null;
  const digits = trimmed.replace(/[\s\-.()+]/g, "");
  return DIGITS.test(digits) ? digits : null;
}

/**
 * Build the wa.me URL for a booking message, or null when the destination is not valid.
 * The whole message is one encoded `text` parameter, so user input cannot add query
 * parameters or change the host.
 *
 * @param {unknown} whatsapp
 * @param {string} [message]
 * @returns {string | null}
 */
export function getBookingUrl(whatsapp, message) {
  const digits = normalizeBookingWhatsApp(whatsapp);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return typeof message === "string" && message.length > 0
    ? `${base}?text=${encodeURIComponent(message)}`
    : base;
}
