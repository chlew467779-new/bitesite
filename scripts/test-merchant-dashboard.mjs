#!/usr/bin/env node
/**
 * Regression coverage for the Merchant self-service dashboard (PR3A).
 *
 * Same convention as the other scripts/test-*.mjs files: the pure modules are executed; source
 * text is only asserted for guards and wiring in the page and the API route.
 *
 * What this guards against regressing:
 *  - Opening hours: per-day Open/Closed with picked times only, stored in the existing
 *    day → string shape; untouched days (including unreadable legacy text) are never rewritten.
 *  - Field validation: empty optional fields are valid; URL, email, phone and WhatsApp have
 *    field-level rules; stored legacy values do not block saving other fields.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CLOSED_VALUE,
  WEEK_DAYS,
  buildOperatingHours,
  hasWeekChanges,
  isEditorHoursValue,
  parseDayForEditor,
  parseWeekForEditor,
  serializeDay,
  toTimeInputValue,
  validateDay,
  validateWeek,
} from "../lib/merchant-hours.mjs";
import {
  PROFILE_TEXT_FIELDS,
  normalizeUrlInput,
  validateProfile,
  validateProfileField,
} from "../lib/merchant-profile-validation.mjs";

/* ── time conversion ───────────────────────────────────────────────────────────────────────── */

for (const [input, expected] of [
  ["09:00", "09:00"],
  ["9:00", "09:00"],
  ["21:30", "21:30"],
  ["9:00 AM", "09:00"],
  ["9:00am", "09:00"],
  ["12:00 AM", "00:00"],
  ["12:30 PM", "12:30"],
  ["10:15 p.m.", "22:15"],
]) {
  assert.equal(toTimeInputValue(input), expected, `${input} → ${expected}`);
}
for (const input of ["", "24:00", "9", "13:00 PM", "0:00 AM", "9:60", "noon", null, 900]) {
  assert.equal(toTimeInputValue(input), null, `${String(input)} is not a time`);
}

/* ── reading stored values ─────────────────────────────────────────────────────────────────── */

assert.deepEqual(parseDayForEditor(undefined), { mode: "unset", slots: [{ open: "", close: "" }], original: null, dirty: false });
assert.deepEqual(parseDayForEditor("   "), { mode: "unset", slots: [{ open: "", close: "" }], original: null, dirty: false });
assert.equal(parseDayForEditor("Closed").mode, "closed");
assert.equal(parseDayForEditor("closed").mode, "closed");
assert.deepEqual(parseDayForEditor("09:00 - 18:00").slots, [{ open: "09:00", close: "18:00" }]);
assert.deepEqual(parseDayForEditor("9:00 AM - 10:00 PM").slots, [{ open: "09:00", close: "22:00" }], "Admin 12-hour values are readable");
assert.deepEqual(parseDayForEditor("09:00-18:00").slots, [{ open: "09:00", close: "18:00" }], "the fixture format is readable");
assert.deepEqual(
  parseDayForEditor("11:00 - 14:00, 17:00 - 22:00").slots,
  [{ open: "11:00", close: "14:00" }, { open: "17:00", close: "22:00" }],
  "split shifts keep both ranges",
);
for (const legacy of ["10am-10pm daily", "Open every day", "11:00 - 14:00, 15:00 - 16:00, 17:00 - 18:00, 19:00 - 20:00"]) {
  const day = parseDayForEditor(legacy);
  assert.equal(day.mode, "legacy", `${legacy} is shown as unreadable text, not guessed`);
  assert.equal(day.original, legacy);
}
const week = parseWeekForEditor({ monday: "09:00 - 18:00", sunday: "Closed", friday: "whenever" });
assert.deepEqual(Object.keys(week), [...WEEK_DAYS], "every weekday has editor state, in order");
assert.equal(week.tuesday.mode, "unset");
assert.equal(week.friday.mode, "legacy");
assert.deepEqual(Object.keys(parseWeekForEditor(null)), [...WEEK_DAYS]);
assert.deepEqual(Object.keys(parseWeekForEditor(["monday"])), [...WEEK_DAYS], "a malformed stored value does not crash the editor");

/* ── writing back ──────────────────────────────────────────────────────────────────────────── */

// Nothing touched: the stored object comes back exactly, including legacy and 12-hour text.
const stored = { monday: "9:00 AM - 10:00 PM", tuesday: "Closed", friday: "whenever" };
const untouched = parseWeekForEditor(stored);
assert.equal(hasWeekChanges(untouched), false);
assert.deepEqual(buildOperatingHours(untouched), stored, "untouched days are saved exactly as they were");

// Merchant opens Wednesday and closes Friday; the rest stays as it was.
const edited = parseWeekForEditor(stored);
edited.wednesday = { ...edited.wednesday, mode: "open", slots: [{ open: "08:00", close: "15:30" }], dirty: true };
edited.friday = { ...edited.friday, mode: "closed", dirty: true };
assert.equal(hasWeekChanges(edited), true);
assert.deepEqual(buildOperatingHours(edited), {
  monday: "9:00 AM - 10:00 PM",
  tuesday: "Closed",
  wednesday: "08:00 - 15:30",
  friday: CLOSED_VALUE,
});
assert.equal(
  serializeDay({ mode: "open", slots: [{ open: "11:00", close: "14:00" }, { open: "17:00", close: "22:00" }], original: null, dirty: true }),
  "11:00 - 14:00, 17:00 - 22:00",
);
assert.equal(serializeDay({ mode: "unset", slots: [], original: null, dirty: true }), null, "a day that is not set is left out");
assert.deepEqual(Object.keys(buildOperatingHours(edited)), ["monday", "tuesday", "wednesday", "friday"], "days stay in week order");

/* ── validation of changed days ────────────────────────────────────────────────────────────── */

const open = (slots) => ({ mode: "open", slots, original: null, dirty: true });
assert.equal(validateDay(open([{ open: "09:00", close: "18:00" }])), null);
assert.equal(validateDay(open([{ open: "18:00", close: "02:00" }])), null, "closing after midnight is allowed");
assert.match(validateDay(open([{ open: "", close: "18:00" }])), /both an opening and a closing time/);
assert.match(validateDay(open([{ open: "09:00", close: "09:00" }])), /must be different/);
assert.match(validateDay(open([{ open: "9am", close: "18:00" }])), /time picker/);
assert.match(validateDay(open([])), /switch the day to Closed/);
assert.equal(validateDay({ mode: "closed", slots: [], original: null, dirty: true }), null);
assert.equal(validateDay({ mode: "legacy", slots: [], original: "x", dirty: false }), null);
const invalidWeek = parseWeekForEditor({ monday: "09:00 - 18:00" });
invalidWeek.tuesday = open([{ open: "10:00", close: "" }]);
invalidWeek.monday = { ...invalidWeek.monday, slots: [{ open: "", close: "" }] }; // not dirty → not validated
assert.deepEqual(Object.keys(validateWeek(invalidWeek)), ["tuesday"], "only changed days are validated");

/* ── the API's format gate ─────────────────────────────────────────────────────────────────── */

for (const value of ["Closed", "09:00 - 18:00", "00:00 - 23:59", "11:00 - 14:00, 17:00 - 22:00", "08:00 - 10:00, 12:00 - 14:00, 18:00 - 23:00"]) {
  assert.ok(isEditorHoursValue(value), `${value} is what the editor writes`);
}
for (const value of ["", "closed", "9:00 - 18:00", "09:00-18:00", "9:00 AM - 10:00 PM", "24:00 - 25:00", "open late", "09:00 - 18:00,17:00 - 22:00", "08:00 - 09:00, 10:00 - 11:00, 12:00 - 13:00, 14:00 - 15:00", null, 42]) {
  assert.ok(!isEditorHoursValue(value), `${String(value)} is not accepted as new free text`);
}
// Everything the editor produces passes the gate.
for (const state of [open([{ open: "07:05", close: "23:55" }]), open([{ open: "11:00", close: "14:00" }, { open: "17:00", close: "22:00" }]), { mode: "closed", slots: [], original: null, dirty: true }]) {
  assert.ok(isEditorHoursValue(serializeDay(state)), "editor output passes the API gate");
}

/* ── profile fields ────────────────────────────────────────────────────────────────────────── */

for (const field of PROFILE_TEXT_FIELDS) {
  assert.equal(validateProfileField(field, ""), null, `${field} may be left empty`);
  assert.equal(validateProfileField(field, null), null, `${field} may be cleared`);
}
assert.match(validateProfileField("name", "x"), /cannot be edited/, "only whitelisted fields are editable");
assert.match(validateProfileField("tagline", "x".repeat(301)), /300 characters or fewer/);
assert.equal(validateProfileField("description", "x".repeat(10000)), null);

assert.equal(validateProfileField("email", "hello@kopitiam.my"), null);
assert.match(validateProfileField("email", "hello@"), /email address/);

for (const url of ["https://kopitiam.my", "http://example.com/menu.pdf", "https://instagram.com/kopitiam"]) {
  assert.equal(validateProfileField("website", url), null, `${url} is a valid URL`);
}
for (const url of ["kopitiam.my", "javascript:alert(1)", "ftp://example.com", "https://", "not a url"]) {
  assert.match(validateProfileField("website", url), /https:\/\//, `${url} is rejected`);
}
assert.equal(normalizeUrlInput("  www.kopitiam.my "), "https://www.kopitiam.my");
assert.equal(normalizeUrlInput("instagram.com/kopitiam"), "https://instagram.com/kopitiam");
assert.equal(normalizeUrlInput("https://kopitiam.my"), "https://kopitiam.my");
assert.equal(normalizeUrlInput("javascript:alert(1)"), "javascript:alert(1)", "other schemes are not rewritten, so they stay invalid");
assert.equal(normalizeUrlInput("@kopitiam"), "@kopitiam", "handles are not guessed into URLs");
assert.equal(normalizeUrlInput(""), "");

assert.equal(validateProfileField("phone", "+60 3-1234 5678"), null);
assert.equal(validateProfileField("phone", "03-1234 5678"), null, "local landline format is fine for a phone number");
assert.match(validateProfileField("phone", "call me"), /digits/);
assert.match(validateProfileField("phone", "123"), /7 to 15 digits/);

assert.equal(validateProfileField("whatsapp", "+60 12-345 6789"), null);
assert.equal(validateProfileField("whatsapp", "60123456789"), null);
assert.match(validateProfileField("whatsapp", "012-345 6789"), /country code/, "a local number would break the wa.me link");
assert.match(validateProfileField("whatsapp", "+60 12 abc"), /digits/);
assert.match(validateProfileField("whatsapp", "+60 12"), /8 to 15 digits/);

// Stored values that fail a newer format rule do not block saving other fields…
assert.deepEqual(
  validateProfile({ whatsapp: "012-345 6789", tagline: "Fresh kopi" }, { whatsapp: "012-345 6789" }),
  {},
  "an unchanged legacy WhatsApp number does not block the save",
);
// …but a changed value is checked, and length limits always apply.
assert.deepEqual(Object.keys(validateProfile({ whatsapp: "012-999 9999" }, { whatsapp: "012-345 6789" })), ["whatsapp"]);
assert.deepEqual(Object.keys(validateProfile({ tagline: "x".repeat(301) }, { tagline: "x".repeat(301) })), ["tagline"]);
assert.deepEqual(validateProfile({}, {}), {}, "fields that are not submitted are not checked");
assert.deepEqual(validateProfile({ whatsapp: "012-345 6789" }, { whatsapp: " 012-345 6789 " }), {}, "stored values are compared trimmed, as submitted values are");
assert.deepEqual(validateProfile({ website: null }, { website: "https://old.example" }), {}, "clearing a field is always allowed");

/* ── API: same auth boundary, shared rules ─────────────────────────────────────────────────── */

async function read(relPath) {
  return readFile(new URL(`../${relPath}`, import.meta.url), "utf8");
}

const routeSource = await read("app/api/merchant/me/route.ts");
const putBody = /export async function PUT\(request: NextRequest\) \{([\s\S]*?)\n\}\n?$/.exec(routeSource);
assert.ok(putBody, "the PUT handler is readable");
assert.match(putBody[1], /supabase\.auth\.getUser\(token\)/, "PUT still requires a signed-in Supabase user");
assert.match(
  putBody[1],
  /from\('merchant_memberships'\)\.select\('merchant_id'\)\.eq\('user_id', userData\.user\.id\)\.eq\('status', 'active'\)/,
  "PUT still resolves the merchant from the caller's own active membership",
);
assert.match(putBody[1], /\.update\(updateData\)\.eq\('id', membership\.merchant_id\)/, "the update is scoped to that merchant only");
assert.doesNotMatch(putBody[1], /body\.(merchant_id|id|slug)\b/, "the merchant is never taken from the request body");
assert.match(routeSource, /from '@\/lib\/merchant-profile-validation\.mjs'/, "the API uses the shared field rules");
assert.match(routeSource, /isEditorHoursValue\(value\)/, "the API enforces the hours format for changed days");
assert.match(routeSource, /fieldErrors/, "validation failures are reported per field");
for (const field of ["name", "slug", "address", "business_status", "platform_status", "is_published", "layout", "status"]) {
  assert.ok(!PROFILE_TEXT_FIELDS.includes(field), `${field} is not merchant-editable`);
}

/* ── dashboard page ────────────────────────────────────────────────────────────────────────── */

const pageSource = await read("app/merchant/page.tsx");
const hoursSource = await read("app/merchant/components/hours-editor.tsx");
assert.doesNotMatch(pageSource, /Request a controlled change|requestControlledChange/, "the controlled-change block is not shown");
assert.doesNotMatch(pageSource, /profile-change-requests/, "the dashboard no longer calls the change-request API");
assert.match(pageSource, /from '@\/lib\/merchant-profile-validation\.mjs'/, "the form uses the same field rules as the API");
assert.match(pageSource, /from '@\/lib\/merchant-hours\.mjs'/, "the form uses the shared hours rules");
assert.doesNotMatch(pageSource, /name=\{`hours-/, "there is no free-text hours field");
const hoursInputs = [...hoursSource.matchAll(/<input\b[\s\S]*?\/>/g)].map((match) => match[0]);
assert.ok(hoursInputs.length > 0 && hoursInputs.every((input) => /type="time"/.test(input)), "the hours editor only has time pickers");
assert.equal((pageSource.match(/\.json\(\)/g) || []).length, 1, "responses are parsed in one place only");
assert.match(
  pageSource,
  /async function readJson\(response: Response\)[\s\S]*?try \{\s*const data = await response\.json\(\);[\s\S]*?\} catch \{\s*return \{\};/,
  "…and that place tolerates a non-JSON error page instead of crashing the form",
);
assert.match(pageSource, /catch \{\s*setSave\(\{ kind: 'error'/, "a network failure is reported, not thrown");
assert.match(pageSource, /data\.fieldErrors/, "server field errors are shown next to their fields");
assert.match(pageSource, /Your changes are still here/, "a failed save says the typed values are kept");
assert.doesNotMatch(pageSource, /event\.currentTarget\.reset\(\)/, "a save never clears the form");

console.log("merchant dashboard checks passed");
