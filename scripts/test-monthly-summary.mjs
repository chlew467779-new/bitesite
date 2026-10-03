/**
 * Monthly summaries: Malaysia-time month ranges, totals from daily rows, change words, the
 * WhatsApp text, and wiring guards for the Owner card, the Admin list and both routes.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { changeWords, summaryChange, summaryMessage, summaryRanges, summaryTotals } from "../lib/monthly-summary-core.mjs";
import { noticeMessage } from "../lib/whatsapp-notify-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// Ranges use Malaysia time (UTC+8).
let r = summaryRanges(new Date("2026-10-03T08:00:00Z"));
assert.deepEqual(r.thisMonth, { from: "2026-10-01", to: "2026-10-03", label: "October 2026" });
assert.deepEqual(r.sameDaysLastMonth, { from: "2026-09-01", to: "2026-09-03", label: "September 2026" });
assert.deepEqual(r.lastMonth, { from: "2026-09-01", to: "2026-09-30", label: "September 2026", key: "2026-09" });
assert.deepEqual(r.monthBefore, { from: "2026-08-01", to: "2026-08-31", label: "August 2026" });
r = summaryRanges(new Date("2026-09-30T16:30:00Z")); // 00:30 on 1 October in Malaysia
assert.equal(r.thisMonth.from, "2026-10-01", "the month turns at Malaysian midnight");
assert.equal(r.thisMonth.to, "2026-10-01");
r = summaryRanges(new Date("2026-03-31T04:00:00Z"));
assert.equal(r.sameDaysLastMonth.to, "2026-02-28", "31 March compares with the end of February");
r = summaryRanges(new Date("2028-03-30T04:00:00Z"));
assert.equal(r.sameDaysLastMonth.to, "2028-02-29", "leap year");
r = summaryRanges(new Date("2027-01-15T04:00:00Z"));
assert.equal(r.lastMonth.key, "2026-12", "January looks back to December");
assert.equal(r.monthBefore.from, "2026-11-01");

// Totals: page views of the restaurant page only; contacts are every way to reach the restaurant.
const rows = [
  { view_date: "2026-09-02", event_type: "page_view", page_type: "merchant", count: 10 },
  { view_date: "2026-09-02", event_type: "page_view", page_type: "story", count: 99 },
  { view_date: "2026-09-02", event_type: "whatsapp_click", page_type: "merchant", count: 2 },
  { view_date: "2026-09-20", event_type: "phone_click", page_type: "merchant", count: 1 },
  { view_date: "2026-09-20", event_type: "directions_click", page_type: "merchant", count: 3 },
  { view_date: "2026-09-20", event_type: "booking_submit", page_type: "merchant", count: 1 },
  { view_date: "2026-09-20", event_type: "menu_view", page_type: "merchant", count: 4 },
  { view_date: "2026-10-01", event_type: "page_view", page_type: "merchant", count: 5 },
  { view_date: "2026-10-02", event_type: "search", page_type: "home", count: 7 },
];
assert.deepEqual(summaryTotals(rows, { from: "2026-09-01", to: "2026-09-30" }), { views: 10, menuViews: 4, contacts: 7, whatsapp: 2, calls: 1, directions: 3 });
assert.deepEqual(summaryTotals(rows, { from: "2026-09-01", to: "2026-09-03" }), { views: 10, menuViews: 0, contacts: 2, whatsapp: 2, calls: 0, directions: 0 });
assert.equal(summaryTotals(rows, { from: "2026-10-01", to: "2026-10-03" }).views, 5);
assert.equal(summaryTotals(null, { from: "2026-10-01", to: "2026-10-03" }).views, 0);

assert.deepEqual(summaryChange(12, 10), { direction: "up", percent: 20 });
assert.deepEqual(summaryChange(9, 10), { direction: "down", percent: 10 });
assert.deepEqual(summaryChange(10, 10), { direction: "same", percent: 0 });
assert.deepEqual(summaryChange(3, 0), { direction: "new", percent: null });
assert.deepEqual(summaryChange(0, 0), { direction: "none", percent: null });
assert.equal(changeWords(12, 10), "up 20%");
assert.equal(changeWords(0, 0), "");

// WhatsApp text.
const zero = { views: 0, menuViews: 0, contacts: 0, whatsapp: 0, calls: 0, directions: 0 };
const summary = { label: "September 2026", previousLabel: "August 2026", current: { ...zero, views: 120, contacts: 15, menuViews: 30 }, previous: { ...zero, views: 100 } };
const message = summaryMessage({ name: "Kopi Ah Seng", summary, slug: "kopi-ah-seng", site: "https://bitesite.example" });
assert.equal(message.subject, "Your BiteSite summary for September 2026");
assert.ok(message.text.startsWith("Hi Kopi Ah Seng, here is your BiteSite summary for September 2026:"));
assert.ok(message.text.includes("120 people opened your page (up 20% from August 2026)"));
assert.ok(message.text.includes("15 customers tapped"));
assert.ok(message.text.includes("30 menu views"));
assert.ok(message.text.includes("https://bitesite.example/store/kopi-ah-seng"));
assert.ok(!message.text.includes("Tip:"));
const quiet = summaryMessage({ name: "X", summary: { ...summary, current: zero, previous: zero }, site: "https://s" });
assert.ok(quiet.text.includes("0 people opened your page\n"), "no comparison when there is nothing to compare");
assert.ok(quiet.text.includes("Tip: share your BiteSite link"), "a quiet month gets a tip");
assert.ok(summaryMessage({ name: "X", summary: { ...summary, current: { ...zero, views: 1, contacts: 1, menuViews: 1 } }, site: "https://s" }).text.includes("1 person opened your page"), "singular");
assert.deepEqual(noticeMessage("monthly_summary", { name: "Kopi Ah Seng", summary, slug: "kopi-ah-seng", site: "https://bitesite.example" }), message, "the one-tap notice uses the same text");

// Wiring.
const owner = await read("app/api/merchant/restaurants/[merchantId]/summary/route.ts");
assert.match(owner, /requireMerchantUser\(request\)/);
assert.match(owner, /owned\.merchants\.find\(\(m\) => m\.id === merchantId\)/, "only the caller's own restaurant");
assert.match(owner, /dailyRows\(slugs, ranges\.lastMonth\.from, ranges\.thisMonth\.to\)/);
const admin = await read("app/api/admin/monthly-summaries/route.ts");
assert.match(admin, /verifyAdminToken\(token\)/, "Admin only");
assert.match(admin, /publicClient\.from\('merchants'\)\.select\('id, name, slug'\)/, "live restaurants come from the public (RLS) view");
const helper = await read("app/api/_lib/monthly-summary.ts");
assert.match(helper, /^import 'server-only';/m);
assert.match(helper, /\.range\(start, start \+ PAGE - 1\)/, "rows are read page by page, never cut at 1000");
assert.match(helper, /from\('merchant_slug_history'\)/, "former web addresses count too");
const dashboard = await read("app/merchant/page.tsx");
assert.match(dashboard, /\(listing\?\.stateSource === 'legacy' \|\| listing\?\.public\) && <MonthlySummaryCard/, "the card shows only for a live page");
const page = await read("app/admin/page.tsx");
assert.match(page, /activeTab === 'monthly-summaries' && <MonthlySummaries \/>/);
const list = await read("app/admin/components/monthly-summaries.tsx");
assert.match(list, /kind: 'monthly_summary'/);
assert.match(list, /<NotifyMerchant notices=\{notices\}/);

console.log("monthly summary checks passed");
