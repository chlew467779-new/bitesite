import assert from "node:assert/strict";
import { compareWithMenu, parseImportRequest, parseMenuImport, parsePrice, toImportItems, MENU_IMPORT_PROMPT } from "../lib/menu-import-core.mjs";

assert.equal(parsePrice(12.5), 12.5);
assert.equal(parsePrice("RM 12.50"), 12.5);
assert.equal(parsePrice("8,90"), 8.9);
assert.equal(parsePrice(""), null);
assert.equal(parsePrice(null), null);
assert.ok(Number.isNaN(parsePrice("12-15")), "a range is not a price");
assert.ok(Number.isNaN(parsePrice("market price")));

// Gemini's usual answer: text around a ```json block; overlapping photos repeat sections and dishes.
const answer = `Here is the menu:
\`\`\`json
{
  "categories": [
    { "name": "Rice", "dishes": [
      { "name": "Nasi Lemak Ayam", "description": null, "price": 12.5, "unclear": false },
      { "name": "Nasi Goreng", "description": "Fried rice", "price": null, "unclear": false }
    ]},
    { "name": "Drinks", "dishes": [ { "name": "Teh Tarik (Hot)", "price": "RM 2.80" } ] },
    { "name": "rice ", "dishes": [
      { "name": "nasi lemak ayam.", "price": 12.5 },
      { "name": "Nasi Goreng", "price": 10 },
      { "name": "Nasi Kerabu", "price": 13, "unclear": true }
    ]},
    { "name": "Noodles", "dishes": [ { "name": "Nasi Lemak Ayam", "price": 12.5 } ] }
  ],
  "notes": ["Bottom right corner was blurry"]
}
\`\`\`
Let me know if you need anything else.`;
const r = parseMenuImport(answer);
assert.equal(r.ok, true);
assert.deepEqual(r.categories.map((c) => c.name), ["Rice", "Drinks", "Noodles"], "same section from another photo merges");
assert.deepEqual(r.categories[0].dishes.map((d) => d.name), ["Nasi Lemak Ayam", "Nasi Goreng", "Nasi Kerabu"], "same dish merges (case, trailing full stop)");
assert.equal(r.merged, 2);
assert.equal(r.categories[0].dishes[1].price, 10, "a missing price is filled from another photo");
assert.equal(r.categories[1].dishes[0].price, 2.8);
assert.equal(r.unclear, 1);
assert.equal(r.total, 5);
assert.deepEqual(r.problems, []);
assert.ok(r.warnings.some((w) => w.includes("Nasi Lemak Ayam") && w.includes("Noodles")), "same dish in two sections is flagged");
assert.deepEqual(r.notes, ["Bottom right corner was blurry"]);

const twoPrices = parseMenuImport('{"categories":[{"name":"Rice","dishes":[{"name":"A","price":5},{"name":"a","price":6}]}]}');
assert.equal(twoPrices.categories[0].dishes[0].price, 5);
assert.equal(twoPrices.categories[0].dishes[0].unclear, true, "two different prices → check it");
assert.equal(twoPrices.warnings.length, 1);

assert.equal(parseMenuImport("").ok, false);
assert.equal(parseMenuImport("Sorry, I cannot read the photo.").ok, false);
assert.equal(parseMenuImport('```json\n{"categories": [ {"name": "Rice"\n```').ok, false, "cut-off JSON");
assert.equal(parseMenuImport('{"items": []}').ok, false);
const bad = parseMenuImport('{"categories":[{"name":"Rice","dishes":[{"name":"A","price":"12-15"},{"price":3}]}]}');
assert.equal(bad.ok, true);
assert.equal(bad.problems.length, 2, "bad price and a nameless dish block the import");
assert.equal(parseMenuImport(JSON.stringify([{ name: "Menu", dishes: [{ name: "X" }] }])).ok, true, "a bare list of sections is accepted");

const cmp = compareWithMenu(r.categories, {
  categories: [{ id: "c1", name: "RICE" }],
  products: [{ categoryId: "c1", name: "nasi goreng" }],
});
assert.equal(cmp.rows[0].isNew, false);
assert.deepEqual(cmp.rows[0].dishes.map((d) => d.exists), [false, true, false], "already on the menu is matched like the database does");
assert.equal(cmp.newDishes, 4);
assert.equal(cmp.newCategories, 2);

assert.deepEqual(toImportItems(r.categories)[0].dishes[0], { name: "Nasi Lemak Ayam", description: null, price: 12.5 }, "unclear flag is not sent");
assert.equal(parseImportRequest({ merchantId: "00000000-0000-4000-8000-000000000001", categories: r.categories }).ok, true);
assert.equal(parseImportRequest({ merchantId: "x", categories: r.categories }).ok, false);
assert.equal(parseImportRequest({ merchantId: "00000000-0000-4000-8000-000000000001", categories: [], extra: 1 }).ok, false);
assert.ok(MENU_IMPORT_PROMPT.includes('"categories"') && MENU_IMPORT_PROMPT.includes("only once"));

console.log("menu import checks passed");
