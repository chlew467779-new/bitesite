/*
 * Phone and WhatsApp numbers (issue #5): owners pick +60 (Malaysia) or +65 (Singapore) and type
 * the rest without the leading 0. New values are stored as "+60165660239". Values saved before
 * this, such as "016-566 0239", are read as Malaysian so links and the editor still work.
 */

export const PHONE_COUNTRIES = Object.freeze([
  Object.freeze({ code: "60", label: "Malaysia +60", example: "165660239" }),
  Object.freeze({ code: "65", label: "Singapore +65", example: "81234567" }),
]);
const CODES = PHONE_COUNTRIES.map((c) => c.code);

const digitsOf = (value) => (typeof value === "string" ? value.replace(/\D/g, "") : "");

/**
 * Split a stored value into `{ country, local }`. Only a value that starts with "+" is trusted to
 * carry a country code; without "+", a leading 0 (or anything else) is a Malaysian local number.
 */
export function splitPhone(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const digits = digitsOf(text);
  if (text.startsWith("+")) {
    const country = CODES.find((code) => digits.startsWith(code));
    if (country) return { country, local: digits.slice(country.length).replace(/^0+/, "") };
  }
  return { country: "60", local: digits.replace(/^0+/, "") };
}

/** Join the picker's parts into the stored form, or null when no number was typed. */
export function joinPhone(country, local) {
  const code = CODES.includes(country) ? country : "60";
  let digits = digitsOf(local).replace(/^0+/, "");
  if (!digits) return null;
  // Recognize a full international number, while preserving local numbers starting with 60/65.
  const internationalLength = code === "65" ? digits.length === 10 : digits.length === 11 || digits.length === 12;
  if (digits.startsWith(code) && (internationalLength || (typeof local === "string" && local.trim().startsWith("+")))) {
    digits = digits.slice(code.length).replace(/^0+/, "");
  }
  return digits ? `+${code}${digits}` : null;
}

/** International digits for tel: and wa.me links ("60165660239"), or null. */
export function phoneLinkDigits(value) {
  const { country, local } = splitPhone(value);
  return local ? `${country}${local}` : null;
}

/** Readable form for the public page: "+60 165660239". */
export function formatPhone(value) {
  const { country, local } = splitPhone(value);
  return local ? `+${country} ${local}` : "";
}
