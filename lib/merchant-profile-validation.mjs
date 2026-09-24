/**
 * Field rules for the Merchant self-service profile, shared by the dashboard form (instant,
 * per-field messages) and PUT /api/merchant/me (the authority). One module, so the two can never
 * disagree about what a valid WhatsApp number or URL is.
 *
 * Rules:
 *  - Every field is optional; an empty value is valid and clears the field.
 *  - Length limits always apply.
 *  - Format rules (email, URL, phone, WhatsApp) apply to values the merchant changed. A value
 *    already stored that no longer passes (e.g. a WhatsApp number saved before this check existed)
 *    does not block saving other fields; the dashboard shows a hint for it instead.
 *
 * Plain ESM so scripts/test-merchant-dashboard.mjs can execute it; types in the .d.mts.
 */

export const PROFILE_TEXT_FIELDS = Object.freeze([
  "tagline",
  "description",
  "phone",
  "whatsapp",
  "email",
  "website",
  "instagram",
  "facebook",
  "cover_image",
  "logo_image",
  "menu_pdf_url",
]);

export const PROFILE_FIELD_LIMITS = Object.freeze({
  tagline: 300,
  description: 10000,
  phone: 40,
  whatsapp: 40,
  email: 254,
  website: 2048,
  instagram: 2048,
  facebook: 2048,
  cover_image: 2048,
  logo_image: 2048,
  menu_pdf_url: 2048,
});

export const URL_FIELDS = Object.freeze(["website", "instagram", "facebook", "cover_image", "logo_image", "menu_pdf_url"]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^\+?[\d\s\-().]+$/;

function digitCount(value) {
  return (value.match(/\d/g) || []).length;
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Friendly clean-up for a URL typed by hand: trims it and adds https:// to a bare domain such as
 * "www.example.com" or "instagram.com/kopitiam". Anything else is returned trimmed and unchanged,
 * so validation can still reject it.
 */
export function normalizeUrlInput(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (/^[^\s/@]+\.[a-z]{2,}(?:[/?#]\S*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/** Message for one field's (trimmed) value, or null when it is valid. `checkFormat` false = length only. */
export function validateProfileField(field, value, checkFormat = true) {
  if (!PROFILE_TEXT_FIELDS.includes(field)) return "This field cannot be edited here.";
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "Enter text.";
  const limit = PROFILE_FIELD_LIMITS[field];
  if (value.length > limit) return `Use ${limit.toLocaleString("en-US")} characters or fewer.`;
  if (!checkFormat) return null;

  if (field === "email" && !EMAIL.test(value)) return "Enter an email address like name@example.com.";
  if (URL_FIELDS.includes(field) && !isHttpUrl(value)) return "Enter a full web address starting with https://";
  if (field === "phone") {
    if (!PHONE_CHARS.test(value)) return "Use digits, spaces, +, - and brackets only.";
    const digits = digitCount(value);
    if (digits < 7 || digits > 15) return "Enter a phone number with 7 to 15 digits.";
  }
  if (field === "whatsapp") {
    if (!PHONE_CHARS.test(value)) return "Use digits, spaces, + and - only.";
    const digits = digitCount(value);
    if (digits < 8 || digits > 15) return "Enter a WhatsApp number with 8 to 15 digits.";
    if (value.replace(/[^\d+]/g, "").replace(/^\+/, "").startsWith("0")) {
      return "Start with the country code, e.g. +60 12-345 6789, so the WhatsApp link works.";
    }
  }
  return null;
}

/**
 * Validates submitted values against the previously stored ones. Only fields present in `values`
 * are checked. Returns { [field]: message }; an empty object means everything is valid.
 */
export function validateProfile(values, previous = {}) {
  const errors = {};
  for (const field of PROFILE_TEXT_FIELDS) {
    if (!(field in values)) continue;
    const value = values[field];
    const unchanged = (value ?? "") === (previous?.[field] ?? "");
    const message = validateProfileField(field, value, !unchanged);
    if (message) errors[field] = message;
  }
  return errors;
}
