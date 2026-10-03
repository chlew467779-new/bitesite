/**
 * Monthly summaries (CH 2026-09-30): "this month vs last month" for a restaurant, from the daily
 * totals in merchant_daily_views (filled hourly, kept after raw visits are deleted). The Owner
 * sees this month so far against the same days last month; Admin sends last month's numbers by
 * one-tap WhatsApp at the start of a month. Dates are Malaysia time.
 *
 * Pure; shared by the summary routes, the dashboard card, the Admin list and
 * scripts/test-monthly-summary.mjs.
 */

export const SUMMARY_TIME_ZONE = "Asia/Kuala_Lumpur";
/** Visitor actions that mean "a customer tried to reach you". */
export const CONTACT_EVENTS = Object.freeze(["whatsapp_click", "phone_click", "directions_click", "merchant_order_click", "website_click", "email_click", "booking_submit"]);
export const SUMMARY_EVENTS = Object.freeze(["page_view", "menu_view", ...CONTACT_EVENTS]);

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const previousMonth = ({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 });
const monthName = (y, m) => new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function malaysiaDate(now) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: SUMMARY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  return { y, m, d };
}

/**
 * The date ranges (inclusive, YYYY-MM-DD): this month so far, the same days last month, all of
 * last month and all of the month before.
 */
export function summaryRanges(now = new Date()) {
  const { y, m, d } = malaysiaDate(now);
  const last = previousMonth({ y, m });
  const before = previousMonth(last);
  return {
    thisMonth: { from: iso(y, m, 1), to: iso(y, m, d), label: monthName(y, m) },
    sameDaysLastMonth: { from: iso(last.y, last.m, 1), to: iso(last.y, last.m, Math.min(d, daysInMonth(last.y, last.m))), label: monthName(last.y, last.m) },
    lastMonth: { from: iso(last.y, last.m, 1), to: iso(last.y, last.m, daysInMonth(last.y, last.m)), label: monthName(last.y, last.m), key: `${last.y}-${pad(last.m)}` },
    monthBefore: { from: iso(before.y, before.m, 1), to: iso(before.y, before.m, daysInMonth(before.y, before.m)), label: monthName(before.y, before.m) },
  };
}

/**
 * Totals for one range from merchant_daily_views rows (`{ view_date, event_type, page_type, count }`).
 * Page views count the restaurant page only, as the Owner statistics do.
 */
export function summaryTotals(rows, range) {
  const totals = { views: 0, menuViews: 0, contacts: 0, whatsapp: 0, calls: 0, directions: 0 };
  for (const row of rows ?? []) {
    if (!row || row.view_date < range.from || row.view_date > range.to) continue;
    const n = Number(row.count) || 0;
    if (row.event_type === "page_view") { if (row.page_type === "merchant") totals.views += n; }
    else if (row.event_type === "menu_view") totals.menuViews += n;
    else if (CONTACT_EVENTS.includes(row.event_type)) {
      totals.contacts += n;
      if (row.event_type === "whatsapp_click") totals.whatsapp += n;
      if (row.event_type === "phone_click") totals.calls += n;
      if (row.event_type === "directions_click") totals.directions += n;
    }
  }
  return totals;
}

/** `{ direction: 'up' | 'down' | 'same' | 'new' | 'none', percent }` from `previous` to `current`. */
export function summaryChange(current, previous) {
  if (!previous) return { direction: current > 0 ? "new" : "none", percent: null };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { direction: percent > 0 ? "up" : percent < 0 ? "down" : "same", percent: Math.abs(percent) };
}

/** Short words for a change: "up 20%", "down 5%", "the same", "new" or "" (nothing to compare). */
export function changeWords(current, previous) {
  const change = summaryChange(current, previous);
  if (change.direction === "up" || change.direction === "down") return `${change.direction} ${change.percent}%`;
  if (change.direction === "same") return "the same";
  return change.direction === "new" ? "new" : "";
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The WhatsApp message Admin sends for last month. `summary` is
 * `{ label, previousLabel, current, previous }` with totals from summaryTotals.
 */
export function summaryMessage({ name, summary, slug, site }) {
  const { label, previousLabel, current, previous } = summary;
  const versus = changeWords(current.views, previous.views);
  const viewsLine = `• ${plural(current.views, "person opened", "people opened")} your page${versus && versus !== "new" ? ` (${versus} from ${previousLabel})` : ""}`;
  const contactLine = `• ${plural(current.contacts, "customer", "customers")} tapped WhatsApp, call, directions or another way to reach you`;
  const menuLine = `• ${plural(current.menuViews, "menu view", "menu views")}`;
  const page = slug ? `\n\nYour page: ${site}/store/${slug}` : "";
  const tip = current.views === 0 ? "\n\nTip: share your BiteSite link on WhatsApp, Instagram or Facebook so more people find you." : "";
  return {
    subject: `Your BiteSite summary for ${label}`,
    text: `Hi ${name || "there"}, here is your BiteSite summary for ${label}:\n${viewsLine}\n${contactLine}\n${menuLine}${page}${tip}\n\nThank you for being on BiteSite!`,
  };
}
