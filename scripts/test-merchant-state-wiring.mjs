/**
 * D1a merchant state foundation: source wiring guards.
 *
 * The real evidence for D1a is in the database tests (supabase/tests/d1a_state_*.sql), which run
 * against a real Postgres. These checks only make sure the application code does not drift back
 * to reading private view counts or re-deciding publication on its own.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

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

/* ── view counts are private (DEC-29) ──────────────────────────────────────────────────────── */

// Only server routes that use the service role may touch merchant_stats.
const STATS_ALLOWED = [/^app\/api\/admin\//, /^app\/api\/view\//, /^app\/api\/track\//];
for (const rel of [...(await listSources("app")), ...(await listSources("components")), ...(await listSources("lib"))]) {
  const source = await read(rel);
  if (/from\(\s*["']merchant_stats["']\s*\)/.test(source)) {
    assert.ok(STATS_ALLOWED.some((re) => re.test(rel)), `${rel} reads merchant_stats; view counts are private since D1a`);
  }
  assert.doesNotMatch(source, /ViewCountInline/, `${rel} still shows a public merchant view count`);
}

const types = await read("types/index.ts");
assert.doesNotMatch(
  types.match(/export interface LayoutProps \{[\s\S]*?\n\}/)[0],
  /viewCount/,
  "public layouts no longer receive a view count",
);

/* ── the migration keeps its contract ──────────────────────────────────────────────────────── */

const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((f) => f.endsWith("_merchant_state_foundation.sql"));
assert.equal(migrations.length, 1, "exactly one D1a migration");
const migration = await read(`supabase/migrations/${migrations[0]}`);
assert.match(migration, /add column state_source\s+text\s+not null default 'legacy'/, "existing and old-Admin rows start as legacy (nothing published or hidden)");
// The owner-only conversion function holds the one legitimate state switch; outside it there is none.
const migrationOutsideConversion = migration.replace(/create or replace function private\.convert_merchant_to_managed[\s\S]*?\n\$\$;/, "");
assert.notEqual(migrationOutsideConversion, migration, "the conversion function body was found");
assert.doesNotMatch(migrationOutsideConversion, /update public\.merchants\s+set\s+(review_status|listing_visibility|state_source)/i, "no bulk approval, publication or state switch in the migration");
assert.match(migration, /create or replace function private\.merchant_is_public/, "the predicate lives outside the PostgREST-exposed schema");
assert.match(migration, /revoke select on table public\.merchant_stats from anon, authenticated;/, "view counts are no longer public");
assert.match(migration, /^commit;\s*$/m, "one transaction");

// legacy → managed only through the owner-only conversion function; the migration never converts.
assert.match(migration, /STATE_SOURCE_CONVERSION_FORBIDDEN/, "the trigger refuses an ordinary legacy → managed update");
assert.match(migration, /create or replace function private\.convert_merchant_to_managed\([\s\S]*?security definer\s+set search_path = ''/,
  "the conversion function pins its search_path");
assert.match(migration, /revoke all on function private\.convert_merchant_to_managed\([^)]*\)\s+from public, anon, authenticated, service_role;/,
  "no application role may convert");
assert.doesNotMatch(migration, /grant execute on function private\.convert_merchant_to_managed/, "and none is granted it later");
assert.doesNotMatch(migration, /(select|perform)\s+private\.convert_merchant_to_managed\(/i, "the migration converts no merchant");
assert.match(migration, /revoke all on table private\.merchant_state_conversion_tickets from public, anon, authenticated, service_role;/,
  "conversion tickets are invisible to the API roles");
assert.doesNotMatch(migration, /set_config\(\s*'app\.(allow|conversion|state)/i, "no session-variable switch authorises a conversion");

/* ── Admin gets a clear refusal instead of a raw 500 ───────────────────────────────────────── */

const adminCrud = await read("app/api/admin/merchants-crud/route.ts");
assert.match(adminCrud, /LEGACY_STATE_WRITE_FORBIDDEN/, "the Admin API recognises the managed-state refusal");
assert.equal((adminCrud.match(/return merchantWriteError\(error\);/g) || []).length, 2, "insert and update both map it");

console.log("merchant state wiring checks passed");
