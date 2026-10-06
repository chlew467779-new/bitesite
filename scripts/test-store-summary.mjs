import assert from "node:assert/strict";
import { openStatus, priceRange, shortTime, malaysiaMinutes } from "../lib/store-summary.mjs";

const at = (h, m = 0) => h * 60 + m;

// shortTime
assert.equal(shortTime(at(15)), "3 pm");
assert.equal(shortTime(at(22, 30)), "10:30 pm");
assert.equal(shortTime(0), "12 am");
assert.equal(shortTime(at(12)), "12 pm");

// openStatus
assert.equal(openStatus(null, at(10)), null);
assert.equal(openStatus("Hours unavailable", at(10)), null);
assert.deepEqual(openStatus("Closed", at(10)), { open: false, label: "Closed today" });
assert.deepEqual(openStatus("8:00 AM - 3:00 PM", at(10)), { open: true, label: "Open now · till 3 pm" });
assert.deepEqual(openStatus("08:00 - 15:00", at(15)), { open: false, label: "Closed now" });
assert.deepEqual(openStatus("8:00 AM - 3:00 PM", at(7)), { open: false, label: "Closed · opens 8 am" });
assert.deepEqual(openStatus("11:00 - 14:30, 18:00 - 22:00", at(16)), { open: false, label: "Closed · opens 6 pm" });
assert.deepEqual(openStatus("11:00 - 14:30, 18:00 - 22:00", at(13)), { open: true, label: "Open now · till 2:30 pm" });
// Overnight slot
assert.deepEqual(openStatus("6:00 PM - 2:00 AM", at(1)), { open: true, label: "Open now · till 2 am" });
assert.deepEqual(openStatus("6:00 PM - 2:00 AM", at(23)), { open: true, label: "Open now · till 2 am" });
assert.ok(malaysiaMinutes(new Date("2026-10-06T00:30:00Z")) === at(8, 30), "KL is UTC+8");

// priceRange
assert.equal(priceRange([], "MYR"), null);
assert.equal(priceRange([{ price: 5 }], "MYR"), null, "one price is not a range");
assert.equal(priceRange([{ price: 5.5 }, { price: 14.2 }], "MYR"), "RM 5–15");
assert.equal(priceRange([{ price: 8 }, { price: 8 }], "SGD"), "S$ 8");
assert.equal(priceRange([{ price: 10, discount_price: 6 }, { price: "12.00" }], "MYR"), "RM 6–12", "discount price counts, string prices count");
assert.equal(priceRange([{ price: 3, show_prices: false }, { price: 9 }, { price: 11 }], "MYR"), "RM 9–11", "hidden prices are skipped");
assert.equal(priceRange([{ price: 0 }, { price: 4 }, { price: 6 }], "MYR"), "RM 4–6", "zero is skipped");
const ten = [1, 5, 6, 7, 8, 9, 10, 11, 12, 80].map((price) => ({ price }));
assert.equal(priceRange(ten, "MYR"), "RM 5–12", "10% trimmed at each end");

console.log("store summary checks passed");
