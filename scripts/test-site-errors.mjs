/**
 * Site errors (SYNC-070): redaction, grouping, request parsing, and the wiring that makes errors
 * reach Admin (instrumentation hook, error pages, badge, Today card).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  fingerprintText, isIgnoredError, messageFromConsoleArgs, pagePathOnly, parseBrowserErrorReport, parseSiteErrorUpdate, redactErrorText, SITE_ERROR_MESSAGE_LIMIT,
} from "../lib/site-errors-core.mjs";

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

/* redaction */
assert.equal(redactErrorText("  merchant_menu_read   failed:\n permission denied  "), "merchant_menu_read failed: permission denied", "one trimmed line");
assert.equal(redactErrorText("no user ali.baba@example.com.my here"), "no user [email] here", "email removed");
assert.equal(redactErrorText("call +60 12-345 6789 now"), "call [number] now", "phone removed");
assert.equal(redactErrorText("on 2026-10-03 at noon"), "on 2026-10-03 at noon", "dates stay");
assert.equal(redactErrorText("key eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abc_DEF-123 bad"), "key [secret] bad", "JWT removed");
assert.equal(redactErrorText("key sb_secret_abcDEF123 bad"), "key [secret] bad", "Supabase secret removed");
assert.equal(redactErrorText("fetch https://x.test/a/b?token=abc&e=1#frag failed"), "fetch https://x.test/a/b failed", "URL query removed");
assert.equal(redactErrorText("⨯ TypeError: x is undefined"), "TypeError: x is undefined", "Next log prefix removed");
assert.equal(redactErrorText("ab ".repeat(300)).length, SITE_ERROR_MESSAGE_LIMIT, "capped");
assert.equal(redactErrorText(null), "");
assert.equal(redactErrorText("   "), "");

/* grouping */
assert.equal(fingerprintText("server", 'Merchant 12 "Kopi A" 3f2a9c1d-1111-2222-3333-444455556666 failed'),
  fingerprintText("server", 'Merchant 345 "Nasi B" 00000000-aaaa-bbbb-cccc-dddddddddddd failed'), "ids, numbers and quoted values group");
assert.notEqual(fingerprintText("server", "a failed"), fingerprintText("browser", "a failed"), "source separates");
assert.notEqual(fingerprintText("server", "a failed"), fingerprintText("server", "b failed"), "different text separates");

/* page paths */
assert.equal(pagePathOnly("/store/kopi?ref=wa#menu"), "/store/kopi");
assert.equal(pagePathOnly("/"), "/");
assert.equal(pagePathOnly("//evil.test/x"), null);
assert.equal(pagePathOnly("https://evil.test/"), null);
assert.equal(pagePathOnly("/a b"), null);
assert.equal(pagePathOnly(42), null);
assert.equal(pagePathOnly(`/${"a".repeat(400)}`).length, 300);

/* console arguments */
assert.equal(messageFromConsoleArgs(["merchant_menu_read failed:", "permission denied"]), "merchant_menu_read failed: permission denied");
assert.equal(messageFromConsoleArgs(["Track error:", { message: "timeout", code: "57014" }]), "Track error: timeout", "Supabase error objects use their message");
assert.equal(messageFromConsoleArgs([new TypeError("x is undefined")]), "TypeError: x is undefined");
assert.equal(messageFromConsoleArgs([new Error("plain")]), "plain");
assert.equal(messageFromConsoleArgs([{ no: "message" }]), "", "nothing readable");
assert.equal(messageFromConsoleArgs([]), "");
assert.equal(messageFromConsoleArgs("not an array"), "");
const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });
assert.equal(messageFromConsoleArgs([redirect]), "", "redirects are not errors");
assert.equal(isIgnoredError("x", "NEXT_HTTP_ERROR_FALLBACK;404"), true, "notFound is not an error");
assert.equal(isIgnoredError("ChunkLoadError: Loading chunk 123 failed."), true, "stale tab after a deploy");
assert.equal(isIgnoredError("TypeError: x"), false);

/* browser reports */
const report = parseBrowserErrorReport({ message: "TypeError: Cannot read properties of undefined (reading 'name')", page: "/store/kopi?x=1" });
assert.deepEqual(report, { ok: true, skip: false, message: "TypeError: Cannot read properties of undefined (reading 'name')", page: "/store/kopi" });
assert.equal(parseBrowserErrorReport({ message: "An error occurred in the Server Components render.", page: "/", digest: "123" }).skip, true, "server crashes were recorded there");
assert.equal(parseBrowserErrorReport({ message: "ChunkLoadError: Loading chunk 9 failed.", page: "/" }).skip, true, "chunk loads skipped");
assert.equal(parseBrowserErrorReport({ message: "x", page: "https://evil.test" }).page, null, "external page dropped");
assert.equal(parseBrowserErrorReport({ message: "", page: "/" }).ok, false, "empty refused");
assert.equal(parseBrowserErrorReport({ message: "x".repeat(2001) }).ok, false, "too long refused");
assert.equal(parseBrowserErrorReport({ message: "x", extra: 1 }).ok, false, "unknown field refused");
assert.equal(parseBrowserErrorReport({ message: "x", digest: 5 }).ok, false, "bad digest refused");
assert.equal(parseBrowserErrorReport(null).ok, false);

/* admin update */
const id = "3f2a9c1d-1111-2222-3333-444455556666";
assert.deepEqual(parseSiteErrorUpdate({ ids: [id, id], status: "resolved" }), { ok: true, ids: [id], status: "resolved" });
assert.equal(parseSiteErrorUpdate({ ids: [id], status: "done" }).ok, false, "unknown status");
assert.equal(parseSiteErrorUpdate({ ids: [], status: "new" }).ok, false, "no ids");
assert.equal(parseSiteErrorUpdate({ ids: Array(101).fill(id), status: "new" }).ok, false, "too many ids");
assert.equal(parseSiteErrorUpdate({ ids: ["x"], status: "new" }).ok, false, "bad id");

/* wiring */
const instrumentation = await read("instrumentation.ts");
assert.match(instrumentation, /export async function register\(\)[\s\S]*installConsoleHook\(\)/, "console hook installed at start");
assert.match(instrumentation, /export const onRequestError[\s\S]*recordRequestError\(error, request\.path\)/, "uncaught errors recorded with their page");
assert.match(instrumentation, /NEXT_RUNTIME !== 'nodejs'/, "Node.js runtime only");
const recorder = await read("app/api/_lib/site-errors.ts");
assert.match(recorder, /state\.original\(\.\.\.args\);\n\s*if \(state\.depth > 0\) return;/, "prints first and never re-enters");
assert.match(recorder, /NODE_ENV !== 'production' && process\.env\.SITE_ERRORS_IN_DEV !== '1'/, "production only unless asked");
assert.doesNotMatch(recorder, /console\.error\(/, "the recorder never logs through the hook");
for (const page of ["app/error.tsx", "app/global-error.tsx"]) assert.match(await read(page), /reportBrowserError\(error\)/, `${page} reports the crash`);
assert.match(await read("app/api/site-errors/route.ts"), /if \(!parsed\.skip\) await recordSiteError\('browser'/, "browser reports recorded unless skipped");
assert.match(await read("app/api/admin/attention/route.ts"), /'site-errors': siteErrors\.error \? 0 : siteErrors\.count \?\? 0/, "badge count, 0 before the migration");
assert.match(await read("app/admin/components/today-panel.tsx"), /onOpenTab\('site-errors'\)/, "Today card opens Site Errors");
assert.match(await read("app/admin/page.tsx"), /activeTab === 'site-errors' && <SiteErrorsInbox \/>/, "Admin page wired");
const migration = await read("supabase/migrations/20261003160000_site_errors.sql");
assert.match(migration, /revoke all on public\.site_errors from anon, authenticated;/);
assert.match(migration, /grant execute on function public\.site_error_record\(text, text, text, text\) to service_role;/);
assert.doesNotMatch(migration, /grant [^;]* to (anon|authenticated)/, "never granted to visitors");

console.log("site errors checks passed");
