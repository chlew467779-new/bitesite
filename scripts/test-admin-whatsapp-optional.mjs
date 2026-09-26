/**
 * Admin merchant CRUD: WhatsApp is optional (DEC-21).
 *
 * A restaurant without WhatsApp simply has no Book a Table (P0). The Admin API and form used to
 * require the field, so a merchant whose test number was removed (S0 stop-loss) could no longer be
 * saved. These checks keep the field optional, keep a new or changed number valid for wa.me, and
 * make sure an unchanged stored value never blocks saving unrelated fields.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeBookingWhatsApp } from "../lib/merchant-booking-target.mjs";
import { validateProfileField } from "../lib/merchant-profile-validation.mjs";

const read = (relPath) => readFile(new URL(`../${relPath}`, import.meta.url), "utf8");

/* ── the Admin rule and the merchant dashboard rule agree ──────────────────────────────────── */

const vectors = [
  "60123456789", "+60 12-345 6789", "6012 345 6789", "(60) 12.345.6789", "12345678", "123456789012345",
  "012-345 6789", "0060123456789", "1234567", "1234567890123456", "+60 12 abc", "abc60123456789",
  "++60123456789", "60+123456789", "https://wa.me/60123456789",
];
for (const value of vectors) {
  assert.equal(
    normalizeBookingWhatsApp(value) !== null,
    validateProfileField("whatsapp", value) === null,
    `Admin and merchant dashboard disagree about ${JSON.stringify(value)}`,
  );
}

/* ── API ───────────────────────────────────────────────────────────────────────────────────── */

const route = await read("app/api/admin/merchants-crud/route.ts");
assert.doesNotMatch(route, /WhatsApp is required/, "the API no longer requires WhatsApp");
assert.match(route, /import \{ normalizeBookingWhatsApp \} from '@\/lib\/merchant-booking-target\.mjs';/,
  "the API validates with the same rule the booking section uses");
assert.match(route, /const unchanged = typeof existingWhatsapp === 'string' && body\.whatsapp\.trim\(\) === existingWhatsapp\.trim\(\);/,
  "an unchanged stored number is not re-validated");
assert.match(route, /if \(!unchanged && !normalizeBookingWhatsApp\(body\.whatsapp\)\) return WHATSAPP_FORMAT_MESSAGE;/,
  "a new or changed number must be a valid international WhatsApp number");
assert.match(route, /\.select\('operating_hours, whatsapp'\)/, "the update reads the stored number to compare");
assert.match(route, /validateMerchantPayload\(body, false, existingOperatingHours, existingMerchant\.whatsapp\)/,
  "the update passes the stored number to the validator");
assert.match(route, /whatsapp: body\.whatsapp\?\.trim\(\) \|\| null,/, "create stores an empty number as null");
assert.match(route, /updateData\.whatsapp = body\.whatsapp\?\.trim\(\) \|\| null;/, "update stores an empty number as null");
assert.doesNotMatch(route, /body\.whatsapp\.trim\(\),|updateData\.whatsapp = body\.whatsapp\.trim\(\);/,
  "no unguarded .trim() on a value that may now be null");

/* ── Admin form ────────────────────────────────────────────────────────────────────────────── */

const form = await read("app/admin/components/merchant-form.tsx");
assert.doesNotMatch(form, /WhatsApp is required/, "the form no longer requires WhatsApp");
assert.doesNotMatch(form, /WhatsApp <span className="text-red-400">\*<\/span>/, "no required marker on the label");
assert.match(form, /WhatsApp <span className="text-slate-500 font-normal">\(optional\)<\/span>/, "the label says optional");
assert.match(form, /import \{ normalizeBookingWhatsApp \} from '@\/lib\/merchant-booking-target\.mjs';/, "the form uses the same rule");
assert.match(form, /form\.whatsapp\.trim\(\) !== \(merchant\?\.whatsapp \|\| ''\)\.trim\(\)/, "the form also skips an unchanged stored number");
assert.match(form, /Book a Table is then hidden on the public page/, "the hint explains what an empty number means");

console.log("admin whatsapp optional checks passed");
