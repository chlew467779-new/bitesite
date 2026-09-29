import assert from "node:assert/strict";
import { findArea, matchAreas } from "../lib/areas-core.mjs";

const areas = [
  { name: "Kepong", state: "Kuala Lumpur", country: "MY", aliases: [] },
  { name: "Kuchai Lama", state: "Kuala Lumpur", country: "MY", aliases: [] },
  { name: "Sungai Besi", state: "Kuala Lumpur", country: "MY", aliases: ["Sg Besi"] },
  { name: "Petaling Jaya", state: "Selangor", country: "MY", aliases: ["PJ"] },
  { name: "Sri Petaling", state: "Kuala Lumpur", country: "MY", aliases: ["Seri Petaling"] },
  { name: "Taman Tun Dr Ismail", state: "Kuala Lumpur", country: "MY", aliases: ["TTDI"] },
];
const names = (list) => list.map((a) => a.name);

assert.deepEqual(names(matchAreas(areas, "k")), ["Kepong", "Kuchai Lama"], "prefix K");
assert.deepEqual(names(matchAreas(areas, "Ke")), ["Kepong"], "prefix Ke narrows");
assert.deepEqual(names(matchAreas(areas, "besi")), ["Sungai Besi"], "word inside the name");
assert.deepEqual(names(matchAreas(areas, "lama")), ["Kuchai Lama"], "second word");
assert.deepEqual(names(matchAreas(areas, "pj")), ["Petaling Jaya"], "alias");
assert.deepEqual(names(matchAreas(areas, "petaling")), ["Petaling Jaya", "Sri Petaling"], "name prefix before word match");
assert.deepEqual(names(matchAreas(areas, "ttdi")), ["Taman Tun Dr Ismail"], "alias TTDI");
assert.deepEqual(matchAreas(areas, "  "), [], "blank query");
assert.deepEqual(matchAreas(areas, "zzz"), [], "no match");
assert.equal(matchAreas(areas, "a", 2).length, 2, "limit");

assert.equal(findArea(areas, "  sungai   besi ")?.name, "Sungai Besi", "find ignores case and spaces");
assert.equal(findArea(areas, "sg besi")?.name, "Sungai Besi", "find by alias");
assert.equal(findArea(areas, "Sungai"), null, "partial text is not an area");
assert.equal(findArea(areas, ""), null, "empty");

console.log("area checks passed");
