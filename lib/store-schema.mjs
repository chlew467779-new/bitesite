/**
 * What Google reads about a restaurant page (schema.org Restaurant, JSON-LD), built only from
 * the public fields the page already shows. Plain ESM so scripts/test-store-schema.mjs runs the
 * exact rules; types in store-schema.d.mts.
 *
 * - Opening hours as openingHoursSpecification (the old "Mo 08:00 - 15:00" strings were not a
 *   format Google reads; "Closed" days are simply left out).
 * - Price range from the menu ("RM 5–15") instead of a fixed "$$".
 * - Map position, all cuisines, and the menu itself (sections, dishes, shown prices).
 */

import { parseSlots, priceRange } from "./store-summary.mjs";
import { hasDisplayablePrice } from "./menu-display.mjs";

const DAYS = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};
// A long menu is still useful to search; this keeps the page payload bounded.
const MAX_MENU_ITEMS = 120;

function hhmm(minutes) {
  const value = minutes % (24 * 60);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** { monday: "08:00 - 15:00", sunday: "Closed" } → openingHoursSpecification entries. */
export function openingHoursSpecification(operatingHours) {
  if (!operatingHours || typeof operatingHours !== "object") return [];
  const specs = [];
  for (const [day, text] of Object.entries(operatingHours)) {
    const dayOfWeek = DAYS[String(day).toLowerCase()];
    if (!dayOfWeek) continue;
    for (const { open, close } of parseSlots(text)) {
      specs.push({ "@type": "OpeningHoursSpecification", dayOfWeek, opens: hhmm(open), closes: hhmm(close) });
    }
  }
  return specs;
}

function shownPrice(product) {
  for (const value of [product?.discount_price, product?.price]) {
    const amount = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) return amount;
  }
  return null;
}

/** Menu sections in page order, each with its dishes; dishes without a category are not public. */
export function menuSchema(categories, products, currency, menuUrl) {
  const byCategory = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    if (!product?.category_id || !product.name) continue;
    if (!byCategory.has(product.category_id)) byCategory.set(product.category_id, []);
    byCategory.get(product.category_id).push(product);
  }
  let budget = MAX_MENU_ITEMS;
  const sections = [];
  const ordered = [...(Array.isArray(categories) ? categories : [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const category of ordered) {
    const dishes = (byCategory.get(category.id) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const items = [];
    for (const dish of dishes) {
      if (budget <= 0) break;
      budget -= 1;
      const item = { "@type": "MenuItem", name: dish.name };
      if (dish.description) item.description = String(dish.description).slice(0, 300);
      const price = hasDisplayablePrice(dish) ? shownPrice(dish) : null;
      if (price !== null) item.offers = { "@type": "Offer", price: price.toFixed(2), priceCurrency: currency === "SGD" ? "SGD" : "MYR" };
      items.push(item);
    }
    if (items.length) sections.push({ "@type": "MenuSection", name: category.name, hasMenuItem: items });
  }
  const menu = { "@type": "Menu", name: "Menu", url: menuUrl };
  if (sections.length) menu.hasMenuSection = sections;
  return menu;
}

/** The Restaurant object for one public page. */
export function restaurantSchema({ merchant, url, categories, products, cuisines }) {
  const currency = merchant.currency === "SGD" ? "SGD" : "MYR";
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: merchant.name,
    url,
  };
  if (merchant.cover_image) data.image = merchant.cover_image;
  if (merchant.description) data.description = merchant.description;
  if (merchant.phone) data.telephone = merchant.phone;
  const cuisineList = (cuisines ?? []).filter(Boolean);
  if (cuisineList.length) data.servesCuisine = cuisineList.length === 1 ? cuisineList[0] : cuisineList;
  const range = priceRange(products, currency);
  if (range) data.priceRange = range;
  if (merchant.address) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: merchant.address,
      ...(merchant.area ? { addressLocality: merchant.area } : {}),
      addressCountry: currency === "SGD" ? "SG" : "MY",
    };
  }
  if (typeof merchant.latitude === "number" && typeof merchant.longitude === "number") {
    data.geo = { "@type": "GeoCoordinates", latitude: merchant.latitude, longitude: merchant.longitude };
  }
  const hours = openingHoursSpecification(merchant.operating_hours);
  if (hours.length) data.openingHoursSpecification = hours;
  data.hasMenu = menuSchema(categories, products, currency, `${url}#menu-section`);
  return data;
}

/** Search title: "Kopi Pagi, Bangsar – Cafe Menu & Prices | BiteSite" (name first, it is what people type). */
export function storeTitle(merchant, cuisine) {
  const place = merchant.area ? `, ${merchant.area}` : "";
  return `${merchant.name}${place} – ${cuisine ? `${cuisine} ` : ""}Menu & Prices | BiteSite`;
}

/** Search snippet: the owner's own description, or a plain line built from the page's facts. */
export function storeDescription(merchant, cuisine, range) {
  const own = typeof merchant.description === "string" ? merchant.description.trim().replace(/\s+/g, " ") : "";
  if (own) return own.length > 155 ? `${own.slice(0, 152).trimEnd()}…` : own;
  const kind = cuisine ? `${cuisine} restaurant` : "restaurant";
  const where = merchant.area ? ` in ${merchant.area}` : "";
  const price = range ? ` Prices ${range}.` : "";
  return `${merchant.name} is a ${kind}${where}. See the menu, photos and opening hours on BiteSite.${price}`;
}
