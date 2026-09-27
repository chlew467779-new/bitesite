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
assert.match(upload, /if \(body\.kind === 'merchant'\) \{\s*return NextResponse\.json\(\{[^}]*code: 'FIELD_NOT_WRITABLE' \}, \{ status: 403 \}\);/, "profile photo upload tickets are refused (M6b)");
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
