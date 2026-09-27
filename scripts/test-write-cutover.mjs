/**
 * D2-B write cutover: source inventory of every server write path to restaurant rows.
 *
 * After the cutover, restaurant fields change only through the field save contract (one database
 * transaction per section, public.merchant_field_patch). This test scans all API code for direct
 * writes to `merchants` and `merchant_external_links` and fails if any path other than the
 * reviewed ones appears, so an old whole-form bypass cannot quietly come back. HTTP behaviour of
 * the retired routes is covered by scripts/test-d2b-cutover-local.mjs.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

async function listSources(dir) {
  const out = [];
  for (const entry of await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await listSources(rel)));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const sources = [...(await listSources("app")), ...(await listSources("lib"))];
const writes = [];
for (const rel of sources) {
  const text = await read(rel);
  for (const match of text.matchAll(/\.from\(\s*['"](merchants|merchant_external_links)['"]\s*\)([\s\S]{0,300})/g)) {
    const chain = match[2].split(/;\s*\n/)[0];
    const op = chain.match(/^\s*\.(update|insert|upsert|delete)\(/m) || chain.match(/\.(update|insert|upsert|delete)\(/);
    if (op) writes.push(`${rel} ${match[1]}.${op[1]}`);
  }
}
assert.deepEqual(writes.sort(), ["app/api/admin/merchants-crud/route.ts merchants.insert"],
  `only the hidden-draft create writes restaurant rows directly; found: ${JSON.stringify(writes)}`);

/* retired or closed entry points */
const crud = await read("app/api/admin/merchants-crud/route.ts");
assert.match(crud, /export async function PUT[\s\S]*?verifyToken\(request\)[\s\S]*?return retired\(/, "Admin whole-form PUT: authenticated, then 410");
assert.match(crud, /export async function DELETE[\s\S]*?verifyToken\(request\)[\s\S]*?return retired\(/, "Admin hard DELETE: authenticated, then 410");
assert.match(crud, /status: 410/, "retired methods return 410");
assert.match(crud, /\.insert\(\{ name, slug, is_published: false, platform_status: 'DRAFT' \}\)/, "create makes a hidden draft only");
assert.match(crud, /key !== 'name' && key !== 'slug'/, "create accepts nothing but name and slug");
assert.doesNotMatch(crud, /saveGrabFoodLink|merchant_external_links'\)\.(upsert|delete|insert|update)/, "no GrabFood write");

const me = await read("app/api/merchant/me/route.ts");
assert.match(me, /export async function PUT[\s\S]*?410, 'LEGACY_WRITE_RETIRED'/, "Merchant whole-form PUT retired");

const upload = await read("app/api/merchant/media/upload-url/route.ts");
assert.match(upload, /if \(body\.kind !== 'story'\) return NextResponse\.json\(\{ error: 'Unsupported media upload kind' \}, \{ status: 400 \}\);/, "only Story uploads use the legacy upload route");
assert.doesNotMatch(upload, /body\.kind === 'merchant'|Photo changes are not open yet/, "obsolete profile upload branch removed");
assert.match(upload, /const bucket = 'story-media';/, "Story photo uploads continue");

const adminUpload = await read("app/api/admin/media/upload-url/route.ts");
assert.doesNotMatch(adminUpload, /^s*merchant: { bucket/m, "Admin upload tickets for profile images are closed too (M6b)");

/* the only field writers */
for (const route of ["app/api/merchant/restaurants/[merchantId]/fields/route.ts", "app/api/admin/merchants/[merchantId]/fields/route.ts"]) {
  assert.match(await read(route), /patchMerchantFields\(request, /, `${route} uses the field save runner`);
}
const runner = await read("app/api/_lib/merchant-field-patch.ts");
assert.match(runner, /supabase\.rpc\('merchant_field_patch'/, "the runner saves through the transactional RPC");

/* no client still calls the retired routes */
for (const rel of sources.filter((file) => file.endsWith(".tsx"))) {
  const text = await read(rel);
  assert.doesNotMatch(text, /merchants-crud[^\n]*\n?[^\n]*method: '(PUT|DELETE)'|method: '(PUT|DELETE)'[^\n]*\n?[^\n]*merchants-crud/, `${rel} does not call retired Admin methods`);
  if (/\/api\/merchant\/me/.test(text)) assert.doesNotMatch(text, /method: 'PUT'/, `${rel} does not call the retired Merchant PUT`);
  assert.doesNotMatch(text, /kind(: |=)['"{]*'merchant'/, `${rel} does not request profile photo uploads`);
}

console.log("write cutover checks passed");

// Execute the Story upload handler with provider I/O mocked: retired kinds must never
// issue a storage ticket, while valid Story uploads keep the same bucket and response.
const { createRequire } = await import('node:module');
const vm = await import('node:vm');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
let denied = null;
let tickets = 0;
const mocks = {
  '@/lib/supabase-admin': { supabaseAdmin: { storage: { from(bucket) {
    assert.equal(bucket, 'story-media');
    return { async createSignedUploadUrl(path) { tickets++; assert.match(path, /^merchant\/synthetic\/.+\.webp$/); return { data: { token: 'synthetic-token' }, error: null }; } };
  } } } },
  '@/lib/bounded-json': { readBoundedJson: (request) => request.json(), InvalidJsonBodyError: class extends Error {}, RequestBodyTooLargeError: class extends Error {} },
  '@/app/api/merchant/_lib/merchant-access': { requireMerchantAccess: async (_request, capability) => {
    assert.equal(capability, 'write');
    return denied ? { response: NextResponse.json({ error: 'denied' }, { status: denied }) } : { merchant: { slug: 'synthetic' } };
  } },
};
const compiled = ts.transpileModule(upload, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const handlerModule = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`)(name => mocks[name] ?? require(name), handlerModule, handlerModule.exports);
const callUpload = (body) => handlerModule.exports.POST(new NextRequest('http://localhost/api/merchant/media/upload-url', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
const valid = { kind: 'story', contentType: 'image/webp', size: 1000 };
for (const kind of ['merchant', 'menu', undefined]) assert.equal((await callUpload({ ...valid, kind })).status, 400);
assert.equal(tickets, 0);
assert.equal((await callUpload({ ...valid, contentType: 'text/html' })).status, 400);
assert.equal((await callUpload({ ...valid, size: 6 * 1024 * 1024 })).status, 413);
const story = await callUpload(valid);
assert.equal(story.status, 200);
const ticket = await story.json();
assert.equal(ticket.bucket, 'story-media');
assert.equal(ticket.token, 'synthetic-token');
assert.equal(ticket.maxBytes, 5 * 1024 * 1024);
assert.equal(tickets, 1);
for (const status of [401, 403, 404]) { denied = status; assert.equal((await callUpload(valid)).status, status); }
assert.equal(tickets, 1, 'denied access cannot issue tickets');
console.log('Story upload handler checks passed (9 request scenarios, mocked provider I/O)');
