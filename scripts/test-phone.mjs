import assert from "node:assert/strict";
import { formatPhone, joinPhone, phoneLinkDigits, splitPhone } from "../lib/phone-core.mjs";

assert.equal(joinPhone("60", "165660239"), "+60165660239", "plain local number");
assert.equal(joinPhone("60", "0165660239"), "+60165660239", "leading 0 is dropped");
assert.equal(joinPhone("60", "16-566 0239"), "+60165660239", "separators are dropped");
assert.equal(joinPhone("65", "8123 4567"), "+6581234567", "Singapore");
assert.equal(joinPhone("60", "  "), null, "empty");
assert.equal(joinPhone("99", "123456789"), "+60123456789", "unknown code falls back to Malaysia");

assert.deepEqual(splitPhone("+60165660239"), { country: "60", local: "165660239" }, "stored MY");
assert.deepEqual(splitPhone("+65 8123 4567"), { country: "65", local: "81234567" }, "stored SG");
assert.deepEqual(splitPhone("016-566 0239"), { country: "60", local: "165660239" }, "legacy local number");
assert.deepEqual(splitPhone("+60 016 566 0239"), { country: "60", local: "165660239" }, "legacy +60 with 0");
assert.deepEqual(splitPhone("06-123 4567"), { country: "60", local: "61234567" }, "Melaka landline is not Singapore");
assert.deepEqual(splitPhone(null), { country: "60", local: "" }, "null");

assert.equal(phoneLinkDigits("016-566 0239"), "60165660239", "legacy value links with country code");
assert.equal(phoneLinkDigits("+6581234567"), "6581234567", "SG link");
assert.equal(phoneLinkDigits(""), null, "no link without a number");
assert.equal(formatPhone("+60165660239"), "+60 165660239", "display");
assert.equal(formatPhone(null), "", "display empty");

console.log("phone checks passed");
