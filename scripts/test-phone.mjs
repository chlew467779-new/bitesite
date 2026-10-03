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

assert.equal(joinPhone("60", "60165660239"), "+60165660239", "full MY number without plus");
assert.equal(joinPhone("60", "+60 16-566 0239"), "+60165660239", "pasted MY number");
assert.equal(joinPhone("60", "601123456789"), "+601123456789", "long MY mobile");
assert.equal(joinPhone("65", "6581234567"), "+6581234567", "full SG number without plus");
assert.equal(joinPhone("65", "+65 8123 4567"), "+6581234567", "pasted SG number");
assert.equal(joinPhone("65", "06581234567"), "+6581234567", "leading zero with SG code");
assert.equal(joinPhone("65", "65001234"), "+6565001234", "SG local landline starting with 65 is preserved");
assert.equal(joinPhone("60", "601234567"), "+60601234567", "local length is not mistaken for a country prefix");
assert.equal(joinPhone("60", "06-123 4567"), "+6061234567", "MY landline is preserved");
for (const number of ["+60165660239", "+601123456789", "+6581234567", "+6565001234", "+6061234567"]) {
  const parts = splitPhone(number);
  assert.equal(joinPhone(parts.country, parts.local), number, `round trip: ${number}`);
}

console.log("phone checks passed");
