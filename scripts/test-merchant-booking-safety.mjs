/**
 * Booking destination safety + legacy review suppression (P0).
 *
 * Behaviour: executes lib/merchant-booking-target.mjs directly — the same rule the storefront uses.
 * Wiring: source assertions that the active public components use that rule, keep no fallback
 * number, label all six booking fields, and no longer render or pass on legacy merchant.reviews.
 * Source assertions guard wiring only; they are not browser or database evidence.
 *
 * All numbers below are fake test data. Nothing here sends a WhatsApp message.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getBookingUrl, normalizeBookingWhatsApp } from "../lib/merchant-booking-target.mjs";

const read = (relPath) => readFile(new URL(`../${relPath}`, import.meta.url), "utf8");

/* ── normalizeBookingWhatsApp ──────────────────────────────────────────────────────────────── */

for (const value of [null, undefined, "", "   ", 60123456789, {}, []]) {
  assert.equal(normalizeBookingWhatsApp(value), null, `${JSON.stringify(value)} has no destination`);
}
assert.equal(normalizeBookingWhatsApp("+60 12-345 6789"), "60123456789");
assert.equal(normalizeBookingWhatsApp("  +60 12-345 6789  "), "60123456789", "surrounding spaces are trimmed");
assert.equal(normalizeBookingWhatsApp("60123456789"), "60123456789");
assert.equal(normalizeBookingWhatsApp("+60 (12) 345.6789"), "60123456789", "readable separators are allowed");
assert.equal(normalizeBookingWhatsApp("012-345 6789"), null, "a local number is not guessed into a country");
for (const value of ["abc60123456789", "+60 12 abc", "60123456789x", "６０１２３４５６７８９"]) {
  assert.equal(normalizeBookingWhatsApp(value), null, `${value}: letters are never stripped to rescue a number`);
}
for (const value of ["++60123456789", "60+123456789", "+60 12+345 6789"]) {
  assert.equal(normalizeBookingWhatsApp(value), null, `${value}: only one leading + is allowed`);
}
assert.equal(normalizeBookingWhatsApp("1234567"), null, "7 digits is too short");
assert.equal(normalizeBookingWhatsApp("1234567890123456"), null, "16 digits is too long");
assert.equal(normalizeBookingWhatsApp("12345678"), "12345678", "8 digits is the shortest accepted shape");
assert.equal(normalizeBookingWhatsApp("123456789012345"), "123456789012345", "15 digits is the longest accepted shape");
for (const value of ["https://wa.me/60123456789", "wa.me/60123456789", "javascript:alert(1)", "tel:+60123456789"]) {
  assert.equal(normalizeBookingWhatsApp(value), null, `${value} is not a number`);
}

/* ── getBookingUrl ─────────────────────────────────────────────────────────────────────────── */

assert.equal(getBookingUrl(null, "hi"), null, "no WhatsApp means no URL");
assert.equal(getBookingUrl("012-345 6789", "hi"), null, "an invalid WhatsApp means no URL");
assert.equal(getBookingUrl("+60 12-345 6789"), "https://wa.me/60123456789");

const tricky = "Name: 陈 🍜\nNotes: A&B ?x=1 #tag https://evil.example/?a=b";
const url = new URL(getBookingUrl("+60 12-345 6789", tricky));
assert.equal(url.origin, "https://wa.me", "user text cannot change the host");
assert.equal(url.pathname, "/60123456789");
assert.deepEqual([...url.searchParams.keys()], ["text"], "user text cannot add query parameters");
assert.equal(url.searchParams.get("text"), tricky, "the whole message round-trips intact");
assert.equal(url.hash, "", "a # in the message does not become a fragment");

/* ── wiring: AppointmentSection ────────────────────────────────────────────────────────────── */

const appointment = await read("app/components/sections/appointment-section.tsx");
assert.match(
  appointment,
  /import \{ getBookingUrl, normalizeBookingWhatsApp \} from "@\/lib\/merchant-booking-target\.mjs";/,
  "the booking form uses the shared destination rule",
);
assert.doesNotMatch(appointment, /60165660239/, "the old testing number fallback is gone from the booking form");
assert.doesNotMatch(appointment, /\|\|\s*phone|phone\s*\|\|/, "the restaurant phone is never a WhatsApp fallback");
assert.doesNotMatch(appointment, /\bphone\?:/, "the component no longer accepts a phone prop to fall back to");
assert.match(appointment, /if \(!normalizeBookingWhatsApp\(whatsapp\)\) return null;/, "no valid WhatsApp renders nothing");
assert.match(appointment, /const url = getBookingUrl\(whatsapp, message\);\s*\n\s*if \(!url\) return;/, "the destination is re-checked at submit time");
assert.doesNotMatch(appointment, /setTimeout/, "no artificial wait before opening WhatsApp");
assert.match(appointment, /window\.open\(url, "_blank", "noopener,noreferrer"\)/, "opened synchronously without an opener");
assert.doesNotMatch(appointment, /Request Sent/, "the page does not claim the request was sent");
assert.match(appointment, /Your booking is not confirmed/, "the visitor is told the booking is not confirmed");
assert.match(appointment, /href=\{bookingUrl\}/, "a manual link stays available if the new tab was blocked");
assert.match(appointment, /getMytToday\(\)/, "the earliest date is Malaysia-local, not UTC");
assert.doesNotMatch(appointment, /toISOString\(\)\.split/, "the old UTC date minimum is gone");

// Analytics records only that the hand-off happened, never what the visitor typed.
const trackCall = appointment.match(/trackEvent\('booking_submit',[\s\S]*?\}\);/);
assert.ok(trackCall, "booking_submit is still tracked");
assert.doesNotMatch(trackCall[0], /formData|message|url/, "no name, phone, notes or URL in analytics");
assert.doesNotMatch(appointment, /console\.(log|info|warn|error)/, "nothing the visitor typed is logged");

// Six labels, each tied to its control.
assert.match(appointment, /const uid = useId\(\);/, "ids are unique per instance");
for (const field of ["name", "phone", "date", "time", "guests", "notes"]) {
  assert.match(appointment, new RegExp(`<label htmlFor=\\{fieldId\\("${field}"\\)\\}`), `the ${field} label points at its control`);
  assert.match(appointment, new RegExp(`\\{\\.\\.\\.fieldA11y\\("${field}"\\)\\}`), `the ${field} control carries its id`);
}
assert.match(appointment, /"aria-describedby": errors\[field\] \? errorId\(field\) : undefined/, "errors are announced with their field");
assert.match(appointment, /target\.focus\(\)/, "the first invalid field receives focus");

/* ── wiring: TierSections and layouts ──────────────────────────────────────────────────────── */

const tier = await read("app/components/sections/tier-sections.tsx");
assert.doesNotMatch(tier, /ReviewsSection/, "the active TierSections no longer imports or renders the review carousel");
assert.doesNotMatch(tier, /merchant\.reviews/, "…and does not read legacy reviews at all");
assert.match(tier, /import \{ normalizeBookingWhatsApp \} from "@\/lib\/merchant-booking-target\.mjs";/);
assert.match(
  tier,
  /const canBook = resolved\.appointment && normalizeBookingWhatsApp\(merchant\.whatsapp\) !== null;/,
  "the booking section needs both the feature and a valid WhatsApp number",
);
assert.match(tier, /\{canBook && \(\s*\n\s*<AppointmentSection/, "the section renders only when bookable");
assert.doesNotMatch(tier, /phone=\{/, "no phone is handed to the booking form");

const elegant = await read("app/layouts/elegant-layout.tsx");
assert.doesNotMatch(elegant, /reviews-section/, "Elegant no longer links to a review section that is not rendered");
assert.match(
  elegant,
  /id: "reserve-section", show: resolvedFeatures\.appointment && normalizeBookingWhatsApp\(merchant\.whatsapp\) !== null/,
  "Elegant's Reserve link follows the same booking rule",
);

for (const layout of ["classic", "elegant", "minimal", "modern", "rustic", "chinese", "malay"]) {
  const source = await read(`app/layouts/${layout}-layout.tsx`);
  assert.doesNotMatch(source, /ReviewsSection|merchant\.reviews/, `${layout} does not render legacy reviews itself`);
  assert.doesNotMatch(source, /60165660239/, `${layout} has no hard-coded booking number`);
}

/* ── wiring: server → public renderer boundary ─────────────────────────────────────────────── */

const store = await read("app/store/[merchant]/page.tsx");
assert.match(store, /return \{ \.\.\.merchant, reviews: null \};/, "the store page strips legacy reviews");
assert.match(store, /<LayoutComponent\s*\n\s*merchant=\{publicMerchant\}/, "the layout receives the stripped merchant");
assert.match(store, /<RelatedMerchants merchants=\{publicRelatedMerchants\}/, "related merchants are stripped too");

// lib/whatsapp.ts is the platform's own enquiry CTA, a different purpose; it is not touched here.
const platformWhatsApp = await read("lib/whatsapp.ts");
assert.ok(platformWhatsApp.length > 0, "the platform enquiry helper still exists");

console.log("merchant booking safety checks passed");
