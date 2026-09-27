/**
 * Notification delivery: email content, provider selection and wiring guards.
 * Database behaviour is tested by supabase/tests/notification_delivery_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { notificationEmail, notificationProvider } from "../lib/notification-content.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const base = { id: "n1", merchantId: "m-1", audience: "owner", message: null, attempts: 1, createdAt: "", merchantName: "Kedai Ah Seng", slug: "kedai", ownerUserId: "u1" };

const rejected = notificationEmail({ ...base, kind: "review_rejected", message: "Please add a real photo." }, "https://bitesite.example/");
assert.match(rejected.subject, /Changes needed for Kedai Ah Seng/);
assert.match(rejected.text, /Please add a real photo\./);
assert.match(rejected.text, /https:\/\/bitesite\.example\/merchant\?merchant=m-1/, "Owner link to the dashboard");
const approved = notificationEmail({ ...base, kind: "review_approved" }, "https://bitesite.example");
assert.match(approved.text, /not public yet/, "approval does not claim the page is live");
const submitted = notificationEmail({ ...base, audience: "admin", kind: "review_submitted" }, "https://bitesite.example");
assert.match(submitted.text, /https:\/\/bitesite\.example\/admin/);
assert.equal(notificationEmail({ ...base, kind: "unknown" }, "x"), null);

assert.equal(notificationProvider({}), null, "nothing configured -> nothing sent");
assert.equal(notificationProvider({ RESEND_API_KEY: "k" }), null, "a sender address is required");
assert.deepEqual(notificationProvider({ RESEND_API_KEY: "k", NOTIFY_FROM: "BiteSite <hi@x.my>" }), { kind: "resend", from: "BiteSite <hi@x.my>" });
assert.equal(notificationProvider({ NOTIFY_PROVIDER: "log", NODE_ENV: "production" }), null, "log provider never in production");
assert.equal(notificationProvider({ NOTIFY_PROVIDER: "log", NODE_ENV: "development" }).kind, "log");

const lib = await read("app/api/_lib/notification-delivery.ts");
assert.match(lib, /if \(!provider\) return \{ configured: false/, "no provider: nothing claimed");
assert.match(lib, /merchant_notification_finish/, "every claimed row gets a result");
assert.match(lib, /auth\.admin\.getUserById\(n\.ownerUserId\)/, "Owner email from Auth, never from the row or request");
const route = await read("app/api/admin/notifications/deliver/route.ts");
assert.match(route, /verifyAdminToken\(token\)/);
assert.match(route, /timingSafeEqual/, "scheduler secret compared in constant time");
const migration = await read("supabase/migrations/20260927190000_notification_delivery.sql");
assert.match(migration, /for update skip locked/, "parallel runs never take the same row");
assert.doesNotMatch(migration, /security definer/i);

console.log("notification checks passed");
