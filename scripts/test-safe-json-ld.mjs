#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { safeJsonLd } from "../lib/safe-json-ld.mjs";

const require = createRequire(import.meta.url);

const payload = {
  title: "</script><script>alert('xss')</script>",
  lineSeparator: "before\u2028after",
  paragraphSeparator: "before\u2029after",
};
const serialized = safeJsonLd(payload);

assert.doesNotMatch(serialized, /<\/script/i, "serialized JSON-LD must not contain a script terminator");
assert.match(serialized, /\\u003c\/script>/i, "less-than signs must be escaped");
assert.match(serialized, /\\u2028/, "U+2028 must be escaped");
assert.match(serialized, /\\u2029/, "U+2029 must be escaped");
assert.deepEqual(JSON.parse(serialized), payload, "serialized JSON-LD must round-trip");

const jsonLdFiles = [
  "app/layout.tsx",
  "app/join-us/page.tsx",
  "app/stories/[slug]/page.tsx",
  "app/store/[merchant]/page.tsx",
];

for (const file of jsonLdFiles) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(source, /safeJsonLd/, `${file} must use the shared JSON-LD serializer`);
  assert.doesNotMatch(
    source,
    /type="application\/ld\+json"[\s\S]{0,180}JSON\.stringify/,
    `${file} must not JSON.stringify JSON-LD directly`,
  );
}

const adminAuthSource = await readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8");
assert.match(adminAuthSource, /process\.env\.ADMIN_SESSION_SECRET/, "admin tokens must use ADMIN_SESSION_SECRET");
assert.doesNotMatch(adminAuthSource, /process\.env\.ADMIN_PASSWORD/, "admin tokens must not use ADMIN_PASSWORD");

const nextConfig = require("../next.config.js");
const responseHeaders = (await nextConfig.headers())[0].headers;
const headersByName = new Map(responseHeaders.map(({ key, value }) => [key, value]));
assert.match(headersByName.get("Content-Security-Policy-Report-Only") || "", /object-src 'none'/, "CSP must begin in Report-Only mode");
assert.equal(headersByName.has("Content-Security-Policy"), false, "CSP must not be enforced before compatibility review");
for (const header of ["Permissions-Policy", "Referrer-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options"]) {
  assert.ok(headersByName.has(header), `missing baseline security header: ${header}`);
}

console.log("security baseline checks passed");
