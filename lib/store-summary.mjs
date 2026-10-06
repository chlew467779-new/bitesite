/**
 * Small facts shown at the top of a restaurant page and on cards (R2 / R7, 2026-10 redesign):
 * "Open now · till 3 pm" and the price range "RM 5–15". Plain ESM so
 * scripts/test-store-summary.mjs runs the exact rules; types in store-summary.d.mts.
 */

import { hasDisplayablePrice } from "./menu-display.mjs";
import { currencySymbol } from "./price-format.mjs";

const TIME = /^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i;

function parseTime(text) {
  const match = TIME.exec(String(text).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (minutes > 59) return null;
  if (period && (hours < 1 || hours > 12)) return null;
  if (!period && hours > 23) return null;
  const h24 = period === "PM" && hours !== 12 ? hours + 12 : period === "AM" && hours === 12 ? 0 : hours;
  return h24 * 60 + minutes;
}

function parseSlots(hoursText) {
  if (typeof hoursText !== "string") return [];
  return hoursText
    .split(/,|\/|&/)
    .map((slot) => slot.split("-").map((part) => part.trim()))
    .filter((parts) => parts.length === 2)
    .map(([open, close]) => ({ open: parseTime(open), close: parseTime(close) }))
    .filter((slot) => slot.open !== null && slot.close !== null);
}

/** 900 → "3 pm", 1350 → "10:30 pm", 0 → "12 am". */
export function shortTime(minutesOfDay) {
  const minutes = ((minutesOfDay % 1440) + 1440) % 1440;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h24 < 12 ? "am" : "pm"}`;
}

/**
 * Today's status from today's hours text ("9:00 AM - 3:00 PM", "14:00 - 22:00, 18:00 - 23:00",
 * "Closed") and the current minute of the day in Malaysia time.
 * Returns null when there are no usable hours (show nothing rather than guess).
 */
export function openStatus(todayHours, nowMinutes) {
  if (typeof todayHours !== "string" || !todayHours.trim()) return null;
  if (todayHours.trim().toLowerCase() === "closed") return { open: false, label: "Closed today" };
  const slots = parseSlots(todayHours);
  if (slots.length === 0) return null;

  for (const { open, close } of slots) {
    const overnight = close < open;
    const inside = overnight ? nowMinutes >= open || nowMinutes < close : nowMinutes >= open && nowMinutes < close;
    if (inside) return { open: true, label: `Open now · till ${shortTime(close)}` };
  }
  const later = slots.map((slot) => slot.open).filter((open) => open > nowMinutes).sort((a, b) => a - b)[0];
  return { open: false, label: later === undefined ? "Closed now" : `Closed · opens ${shortTime(later)}` };
}

/** Current minute of the day in Asia/Kuala_Lumpur (Singapore uses the same offset). */
export function malaysiaMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

function effectivePrice(product) {
  for (const value of [product?.discount_price, product?.price]) {
    const amount = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) return amount;
  }
  return null;
}

/**
 * Price range from the menu: "RM 5–15" (R7). Uses each dish's shown price (discount first),
 * skips hidden prices and zero, and with 5+ prices drops the cheapest and dearest 10% so one
 * RM 1 add-on or RM 80 platter does not stretch it. Whole ringgit: low rounded down, high up.
 * Null when fewer than 2 dishes have a price.
 */
export function priceRange(products, currency) {
  const prices = (Array.isArray(products) ? products : [])
    .filter((product) => hasDisplayablePrice(product))
    .map(effectivePrice)
    .filter((price) => price !== null)
    .sort((a, b) => a - b);
  if (prices.length < 2) return null;
  const trim = prices.length >= 5 ? Math.floor(prices.length * 0.1) : 0;
  const kept = prices.slice(trim, prices.length - trim);
  // Below 1 ringgit, rounding down would read "RM 0", so keep the cents ("RM 0.50–7").
  const low = kept[0] < 1 ? kept[0].toFixed(2) : String(Math.floor(kept[0]));
  const high = String(Math.ceil(kept[kept.length - 1]));
  const symbol = currencySymbol(currency);
  return low === high ? `${symbol} ${low}` : `${symbol} ${low}–${high}`;
}
