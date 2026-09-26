/**
 * D1b public merchant projection: list consistency and source wiring guards.
 *
 * The real evidence is in the database tests (supabase/tests/d1b_projection_*.sql), which run
 * against a real Postgres with the anon / authenticated roles. These checks make sure the
 * application only asks for granted columns (otherwise public pages fail with "permission
 * denied" once the migration is applied) and that the column list has one meaning everywhere.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PUBLIC_MERCHANT_COLUMNS, PUBLIC_MERCHANT_SELECT } from "../lib/public-merchant-projection.mjs";

const read = (relPath) => readFile(new URL(`../${relPath}`, import.meta.url), "utf8");

async function listSources(dir) {
  const out = [];
  for (const entry of await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await listSources(rel)));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const quotedNames = (text) => [...text.matchAll(/'([a-z_]+)'|"([a-z_]+)"/g)].map((m) => m[1] ?? m[2]);
const bareNames = (text) => text.split(",").map((c) => c.trim()).filter(Boolean);
const sorted = (list) => [...list].sort();

/* ── one list, everywhere ──────────────────────────────────────────────────────────────────── */

const expected = sorted(PUBLIC_MERCHANT_COLUMNS);
assert.equal(new Set(expected).size, expected.length, "no duplicate public columns");
assert.equal(PUBLIC_MERCHANT_SELECT, PUBLIC_MERCHANT_COLUMNS.join(","), "the select string is the column list");
for (const privateColumn of ["reviews", "settings", "reference_website", "custom_style", "style", "is_published",
  "platform_status", "review_status", "listing_visibility", "platform_restriction", "state_source", "revision",
  "first_published_at"]) {
  assert.ok(!PUBLIC_MERCHANT_COLUMNS.includes(privateColumn), `${privateColumn} must stay private`);
}

const dts = await read("lib/public-merchant-projection.d.mts");
assert.deepEqual(sorted(quotedNames(dts.match(/PUBLIC_MERCHANT_COLUMNS: readonly \[([\s\S]*?)\];/)[1])), expected,
  "the .d.mts tuple matches the runtime list");

const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((f) => f.endsWith("_merchant_public_projection.sql"));
assert.equal(migrations.length, 1, "exactly one D1b migration");
const migration = await read(`supabase/migrations/${migrations[0]}`);
assert.deepEqual(sorted(bareNames(migration.match(/grant select \(([\s\S]*?)\) on table public\.merchants to anon, authenticated;/)[1])), expected,
  "the migration grants exactly the public list");
assert.deepEqual(sorted(quotedNames(migration.match(/expected text\[\] := array\[([\s\S]*?)\];/)[1])), expected,
  "the migration self-check uses the same list");
assert.match(migration, /revoke select on table public\.merchants from anon, authenticated;/, "table-wide SELECT is revoked");
assert.match(migration, /create or replace function private\.merchant_id_is_public\(p_merchant_id uuid\)[\s\S]*?security definer\s+set search_path = ''/,
  "the child-table predicate is a fixed-search_path function outside the exposed schema");
assert.match(migration, /revoke all on function private\.merchant_id_is_public\(uuid\) from public;/, "no default PUBLIC execute");
assert.doesNotMatch(migration, /\b(update|delete from|insert into)\s+public\.merchants\b/i, "the migration changes no merchant data");
assert.match(migration, /^commit;\s*$/m, "one transaction");

const assertions = await read("supabase/tests/d1b_projection_assertions.sql");
assert.deepEqual(sorted(quotedNames(assertions.match(/public_columns text\[\] := array\[([\s\S]*?)\];/)[1])), expected,
  "the catalog assertions use the same list");
const behaviour = await read("supabase/tests/d1b_projection_behavior_tests.sql");
assert.deepEqual(
  sorted(bareNames(behaviour.match(/public_select text := ([\s\S]*?);\n/)[1].replace(/'\s*\|\|\s*'/g, "").replace(/'/g, ""))),
  expected,
  "the behaviour test reads the same list the app sends",
);

/* ── public reads ask only for granted columns ─────────────────────────────────────────────── */

const allowed = new Set(PUBLIC_MERCHANT_COLUMNS);
const serviceRoleImport = /from ["']@\/lib\/supabase-admin["']/;
let publicMerchantReads = 0;
for (const rel of [...(await listSources("app")), ...(await listSources("components")), ...(await listSources("lib"))]) {
  const source = await read(rel);
  if (serviceRoleImport.test(source) || rel === "lib/supabase-admin.ts") {
    // Service-role code may read everything, but must not decide merchant visibility on its own
    // for the public analytics endpoints (checked below).
    continue;
  }
  assert.doesNotMatch(source, /merchants\s*\(/, `${rel}: no embedded merchants(...) select through a public client`);
  for (const match of source.matchAll(/\.from\(\s*["']merchants["']\s*\)(?=([\s\S]{0,400}))/g)) {
    publicMerchantReads += 1;
    const chain = match[1].split(/;\s*\n|\n\s*\n/)[0];
    const select = chain.match(/\.select\(\s*([^)]*)\)/);
    assert.ok(select, `${rel}: a public merchants query must select explicit columns`);
    const arg = select[1].trim();
    if (!/^PUBLIC_MERCHANT_SELECT\b/.test(arg)) {
      const literal = arg.match(/^(["'`])([^"'`]*)\1/);
      assert.ok(literal, `${rel}: select(${arg}) must be PUBLIC_MERCHANT_SELECT or a literal column list`);
      assert.notEqual(literal[2].trim(), "*", `${rel}: select("*") on merchants fails for the public roles`);
      for (const column of bareNames(literal[2])) {
        assert.ok(allowed.has(column), `${rel}: merchants.${column} is not a public column`);
      }
    }
    assert.doesNotMatch(chain, /is_published|platform_status|review_status|listing_visibility|platform_restriction|state_source|revision/,
      `${rel}: public merchant queries must not filter or sort on private state; row level security decides visibility`);
  }
}
assert.ok(publicMerchantReads >= 7, `expected the known public merchant reads (lib/supabase.ts, home, sitemap), found ${publicMerchantReads}`);

const supabaseLib = await read("lib/supabase.ts");
assert.doesNotMatch(supabaseLib, /select\(\s*["']\*["']\s*\)[\s\S]{0,80}\.from\(\s*["']merchants/, "lib/supabase.ts has no select(*) on merchants");
assert.match(supabaseLib, /export async function isPublicMerchantSlug\(slug: string\): Promise<boolean>/, "shared public slug check exists");

/* ── analytics count public merchants only ─────────────────────────────────────────────────── */

for (const rel of ["app/api/view/route.ts", "app/api/track/route.ts"]) {
  const source = await read(rel);
  assert.match(source, /isPublicMerchantSlug\(slug\)/, `${rel} checks the merchant slug with the public rule`);
  assert.doesNotMatch(source, /\.from\(\s*["']merchants["']\s*\)/, `${rel} no longer looks merchants up with the service role`);
}

/* ── public renderers are typed to the projection ──────────────────────────────────────────── */

const types = await read("types/index.ts");
assert.match(types, /export type PublicMerchant = Pick<Merchant, PublicMerchantColumn>;/, "PublicMerchant is derived from the column list");
assert.match(types.match(/export interface LayoutProps \{[\s\S]*?\n\}/)[0], /merchant: PublicMerchant;/, "layouts receive only public columns");
for (const rel of ["app/components/sections/tier-sections.tsx", "components/sections/merchant-card.tsx",
  "components/sections/related-merchants.tsx", "components/sections/map-section.tsx", "components/sections/map-sidebar.tsx",
  "components/sections/map-container.tsx", "app/page.tsx", "app/store/[merchant]/page.tsx"]) {
  const source = await read(rel);
  assert.match(source, /\bPublicMerchant\b/, `${rel} is typed to PublicMerchant`);
  assert.doesNotMatch(source, /import type \{[^}]*\bMerchant\b[^}]*\} from "@\/types"/, `${rel} does not take the full private Merchant type`);
}

const pkg = JSON.parse(await read("package.json"));
assert.match(pkg.scripts.verify, /npm run test:public-projection/, "the projection checks run in verify");

console.log("merchant public projection checks passed");
