import assert from "node:assert/strict";
import { openingHoursSpecification, menuSchema, restaurantSchema, storeTitle, storeDescription } from "../lib/store-schema.mjs";

// Opening hours: Google's format, closed days left out, split shifts kept, 12-hour text read.
assert.deepEqual(openingHoursSpecification({ monday: "08:00 - 15:00", sunday: "Closed" }), [
  { "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "08:00", closes: "15:00" },
]);
assert.deepEqual(
  openingHoursSpecification({ friday: "11:00 - 14:30, 6:00 PM - 10:00 PM" }).map((h) => `${h.opens}-${h.closes}`),
  ["11:00-14:30", "18:00-22:00"],
);
assert.deepEqual(openingHoursSpecification({ saturday: "22:00 - 02:00" })[0].closes, "02:00", "overnight hours keep the closing time");
assert.deepEqual(openingHoursSpecification(null), []);
assert.deepEqual(openingHoursSpecification({ holiday: "09:00 - 10:00" }), [], "unknown day names are skipped");

// Menu: page order, hidden prices and uncategorised dishes stay out, currency follows the page.
const categories = [{ id: "c2", name: "Drinks", sort_order: 2 }, { id: "c1", name: "Mains", sort_order: 1 }];
const products = [
  { category_id: "c2", name: "Kopi O", price: 3.2, sort_order: 1 },
  { category_id: "c1", name: "Nasi Lemak", price: 9, discount_price: 7.5, sort_order: 1, description: "With sambal" },
  { category_id: "c1", name: "Secret dish", price: 20, show_prices: false, sort_order: 2 },
  { category_id: null, name: "Draft", price: 5 },
];
const menu = menuSchema(categories, products, "MYR", "https://x/store/a#menu-section");
assert.deepEqual(menu.hasMenuSection.map((s) => s.name), ["Mains", "Drinks"]);
assert.deepEqual(menu.hasMenuSection[0].hasMenuItem[0].offers, { "@type": "Offer", price: "7.50", priceCurrency: "MYR" }, "discounted price is the one shown");
assert.equal(menu.hasMenuSection[0].hasMenuItem[1].offers, undefined, "a hidden price is not given to Google");
assert.equal(JSON.stringify(menu).includes("Draft"), false, "uncategorised dishes are not public");
assert.equal(menuSchema(categories, products, "SGD", "u").hasMenuSection[1].hasMenuItem[0].offers.priceCurrency, "SGD");
const many = Array.from({ length: 300 }, (_, i) => ({ category_id: "c1", name: `Dish ${i}`, price: 5, sort_order: i }));
assert.equal(menuSchema(categories, many, "MYR", "u").hasMenuSection[0].hasMenuItem.length, 120, "long menus are capped");

// Restaurant: real price range, map position, all cuisines; no invented fields.
const merchant = {
  name: "Kopi Pagi", area: "Bangsar", address: "12 Jalan Telawi", currency: "MYR", phone: "+60123456789",
  latitude: 3.13, longitude: 101.67, cover_image: "https://img/cover.webp", description: "Kopi and toast.",
  operating_hours: { monday: "08:00 - 15:00" },
};
const schema = restaurantSchema({ merchant, url: "https://x/store/kopipagi", categories, products, cuisines: ["Cafe", "Malay", null] });
assert.equal(schema["@type"], "Restaurant");
assert.equal(schema.priceRange, "RM 3–8", "price range comes from the menu (shown prices 3.20 and 7.50; hidden price left out)");
assert.deepEqual(schema.servesCuisine, ["Cafe", "Malay"]);
assert.deepEqual(schema.geo, { "@type": "GeoCoordinates", latitude: 3.13, longitude: 101.67 });
assert.equal(schema.openingHoursSpecification.length, 1);
assert.equal(schema.address.addressCountry, "MY");
assert.equal("aggregateRating" in schema, false, "no ratings: BiteSite has no verified reviews");
const bare = restaurantSchema({ merchant: { name: "Bare" }, url: "u", categories: [], products: [], cuisines: [] });
assert.deepEqual(Object.keys(bare).sort(), ["@context", "@type", "hasMenu", "name", "url"].sort(), "empty fields are left out, not guessed");

// Search title and snippet.
assert.equal(storeTitle(merchant, "Cafe"), "Kopi Pagi, Bangsar – Cafe Menu & Prices | BiteSite");
assert.equal(storeTitle({ name: "Solo" }, null), "Solo – Menu & Prices | BiteSite");
assert.equal(storeDescription(merchant, "Cafe", "RM 3–7"), "Kopi and toast.");
assert.equal(storeDescription({ name: "Solo", area: "Ipoh" }, "Chinese", "RM 5–12"), "Solo is a Chinese restaurant in Ipoh. See the menu, photos and opening hours on BiteSite. Prices RM 5–12.");
assert.ok(storeDescription({ name: "Long", description: "x".repeat(400) }, null, null).length <= 155);

console.log("store schema checks passed");
