/**
 * D1c public Story (articles) projection: list consistency and source wiring guards.
 *
 * The real evidence is in the database tests (supabase/tests/d1c_projection_*.sql). These checks
 * make sure the application only asks for granted Story columns (otherwise public Story pages
 * fail with "permission denied" once the migration is applied), never shows a public view
 * count, and that the column list has one meaning everywhere.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PUBLIC_ARTICLE_COLUMNS, PUBLIC_ARTICLE_SELECT } from "../lib/public-article-projection.mjs";

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

const PRIVATE_COLUMNS = ["published", "view_count", "editorial_status", "rights_declared", "review_notes",
  "submitted_at", "reviewed_at", "reviewed_by", "generated_copy", "generated_copy_at"];

/* ── one list, everywhere ──────────────────────────────────────────────────────────────────── */

const expected = sorted(PUBLIC_ARTICLE_COLUMNS);
assert.equal(new Set(expected).size, expected.length, "no duplicate public Story columns");
assert.equal(PUBLIC_ARTICLE_SELECT, PUBLIC_ARTICLE_COLUMNS.join(","), "the select string is the column list");
for (const column of PRIVATE_COLUMNS) assert.ok(!PUBLIC_ARTICLE_COLUMNS.includes(column), `${column} must stay private`);

const dts = await read("lib/public-article-projection.d.mts");
assert.deepEqual(sorted(quotedNames(dts.match(/PUBLIC_ARTICLE_COLUMNS: readonly \[([\s\S]*?)\];/)[1])), expected,
  "the .d.mts tuple matches the runtime list");

const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((f) => f.endsWith("_article_public_projection.sql"));
assert.equal(migrations.length, 1, "exactly one D1c migration");
const migration = await read(`supabase/migrations/${migrations[0]}`);
assert.deepEqual(sorted(bareNames(migration.match(/grant select \(([\s\S]*?)\) on table public\.articles to anon, authenticated;/)[1])), expected,
  "the migration grants exactly the public list");
assert.deepEqual(sorted(quotedNames(migration.match(/expected text\[\] := array\[([\s\S]*?)\];/)[1])), expected,
  "the migration self-check uses the same list");
assert.deepEqual(sorted(quotedNames(migration.match(/must_be_private text\[\] := array\[([\s\S]*?)\];/)[1])), sorted(PRIVATE_COLUMNS),
  "the migration names the same private columns");
assert.match(migration, /revoke select on table public\.articles from anon, authenticated;/, "table-wide SELECT is revoked");
assert.match(migration, /create or replace function private\.article_is_public\(a public\.articles\)[\s\S]*?security invoker\s+set search_path = ''/,
  "the Story predicate is an invoker function with a fixed search_path outside the exposed schema");
assert.match(migration, /coalesce\(a\.published, false\) and a\.editorial_status = 'published'/, "public means published and editorially published");
assert.doesNotMatch(migration, /\b(update|delete from|insert into)\s+public\.articles\b/i, "the migration changes no Story data");
assert.match(migration, /^commit;\s*$/m, "one transaction");

const assertions = await read("supabase/tests/d1c_projection_assertions.sql");
assert.deepEqual(sorted(quotedNames(assertions.match(/public_columns text\[\] := array\[([\s\S]*?)\];/)[1])), expected,
  "the catalog assertions use the same list");
const behaviour = await read("supabase/tests/d1c_projection_behavior_tests.sql");
assert.deepEqual(
  sorted(bareNames(behaviour.match(/public_select text := ([\s\S]*?);\r?\n/)[1].replace(/'\s*\|\|\s*'/g, "").replace(/'/g, ""))),
  expected,
  "the behaviour test reads the same list the app sends",
);

/* ── public Story reads ask only for granted columns ───────────────────────────────────────── */

const allowed = new Set(PUBLIC_ARTICLE_COLUMNS);
const serviceRoleImport = /from ["']@\/lib\/supabase-admin["']/;
let publicStoryReads = 0;
for (const rel of [...(await listSources("app")), ...(await listSources("components")), ...(await listSources("lib"))]) {
  const source = await read(rel);
  if (serviceRoleImport.test(source) || rel === "lib/supabase-admin.ts") continue;
  assert.doesNotMatch(source, /articles\s*\(/, `${rel}: no embedded articles(...) select through a public client`);
  for (const match of source.matchAll(/\.from\(\s*["']articles["']\s*\)(?=([\s\S]{0,400}))/g)) {
    publicStoryReads += 1;
    const chain = match[1].split(/;\s*\r?\n|\r?\n\s*\r?\n/)[0];
    const select = chain.match(/\.select\(\s*([^)]*)\)/);
    assert.ok(select, `${rel}: a public articles query must select explicit columns`);
    const arg = select[1].trim();
    if (!/^PUBLIC_ARTICLE_SELECT\b/.test(arg)) {
      const literal = arg.match(/^(["'`])([^"'`]*)\1/);
      assert.ok(literal, `${rel}: select(${arg}) must be PUBLIC_ARTICLE_SELECT or a literal column list`);
      assert.notEqual(literal[2].trim(), "*", `${rel}: select("*") on articles fails for the public roles`);
      for (const column of bareNames(literal[2])) assert.ok(allowed.has(column), `${rel}: articles.${column} is not a public column`);
    }
    assert.doesNotMatch(chain, new RegExp(`\\b(${PRIVATE_COLUMNS.join("|")})\\b`),
      `${rel}: public Story queries must not filter or sort on private columns; row level security decides visibility`);
  }
}
assert.ok(publicStoryReads >= 9, `expected the known public Story reads, found ${publicStoryReads}`);

const supabaseLib = await read("lib/supabase.ts");
assert.match(supabaseLib, /export async function isPublicArticleSlug\(slug: string\): Promise<boolean>/, "shared public Story slug check exists");

/* ── analytics count public Stories only ───────────────────────────────────────────────────── */

const storyView = await read("app/api/story-view/route.ts");
assert.match(storyView, /isPublicArticleSlug\(slug\)/, "story-view checks the Story with the public rule");
assert.doesNotMatch(storyView, /\.from\(\s*["']articles["']\s*\)/, "story-view no longer looks Stories up with the service role");
const track = await read("app/api/track/route.ts");
assert.match(track, /isPublicArticleSlug\(slug\)/, "track checks Story page views with the public rule");
assert.match(track, /isPublicArticleSlug\(eventDetail\)/, "track checks the Story side of story-to-merchant events");
assert.doesNotMatch(track, /\.from\(\s*["']articles["']\s*\)/, "track no longer looks Stories up with the service role");

/* ── no public view counts (DEC-29) and renderers typed to the projection ──────────────────── */

for (const rel of ["components/sections/story-card.tsx", "components/sections/story-hero.tsx", "components/sections/story-list.tsx",
  "components/sections/latest-stories.tsx", "app/stories/stories-content.tsx", "app/stories/page.tsx", "app/stories/[slug]/page.tsx"]) {
  const source = await read(rel);
  assert.doesNotMatch(source, /view_count|viewCount/, `${rel} does not show a public view count`);
  assert.match(source, /\bPublicArticle\b/, `${rel} is typed to PublicArticle`);
  assert.doesNotMatch(source, /import type \{[^}]*\bArticle\b[^}]*\} from "@\/types"/, `${rel} does not take the full private Article type`);
}
const types = await read("types/index.ts");
assert.match(types, /export type PublicArticle = Pick<Article, PublicArticleColumn>;/, "PublicArticle is derived from the column list");

const pkg = JSON.parse(await read("package.json"));
assert.match(pkg.scripts.verify, /npm run test:article-projection/, "the Story projection checks run in verify");

console.log("article public projection checks passed");
