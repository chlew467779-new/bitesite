/**
 * Admin merchant CRUD: WhatsApp is optional (DEC-21).
 *
 * A restaurant without WhatsApp simply has no Book a Table (P0). These checks keep the field
 * optional and keep a new or changed number valid for wa.me. Since D2-B an unchanged stored value
 * is never re-sent (only changed fields are saved), so it cannot block saving other fields.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeBookingWhatsApp } from "../lib/merchant-booking-target.mjs";
import { validateProfileField } from "../lib/merchant-profile-validation.mjs";
import { parseFieldPatchRequest } from "../lib/merchant-field-patch-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

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

/* ── Admin save contract (D2-B) ──────────────────────────────────────────────────────────── */
// The old whole-form PUT is retired; Admin saves WhatsApp through the field save contract, which
// applies the same validator as the Merchant dashboard (and, for the contact minimum, the booking
// normalizer in the database).

const REQ = "7d1c3a52-5b1e-4c8e-9a51-0e2c55d2a002";
const patch = (value, expected = { exists: true, value: "60123456789" }) =>
  parseFieldPatchRequest({ requestId: REQ, patches: [{ path: "profile.whatsapp", expected, value }] }, "admin");
assert.equal(patch(null).ok, true, "Admin may clear WhatsApp (optional)");
assert.equal(patch("+60 12-345 6789").ok, true, "a valid international number is accepted");
for (const bad of ["012-345 6789", "abc60123456789", "1234567"]) {
  assert.equal(patch(bad).ok, false, `${bad} is rejected as a new value`);
}
const route = await read("app/api/admin/merchants-crud/route.ts");
assert.doesNotMatch(route, /whatsapp/i, "the Admin create/list route does not write WhatsApp");

/* ── Admin form ────────────────────────────────────────────────────────────────────────────── */

const form = await read("app/admin/components/merchant-form.tsx");
assert.doesNotMatch(form, /WhatsApp is required/, "the form no longer requires WhatsApp");
assert.ok(form.includes("label: 'WhatsApp (optional; international"), "the label says optional and international");
assert.ok(form.includes("value.trim() === '' ? null : "), "an emptied field is sent as null (cleared), not an empty string");
assert.match(form, /Shown only when the restaurant has a valid WhatsApp number/, "Book a Table explains it needs a valid number");

console.log("admin whatsapp optional checks passed");
