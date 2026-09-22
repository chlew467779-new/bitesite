#!/usr/bin/env node
/**
 * Source-pattern regression checks for the Admin Menu Editor (categories/products CRUD).
 *
 * This repo has no jest/vitest — regression coverage here follows the same convention as
 * scripts/test-safe-json-ld.mjs: assert on the actual source text of the files that matter,
 * rather than introducing a new test framework dependency for one feature.
 *
 * What this guards against regressing:
 *  - Every HTTP verb on both menu-categories and menu-products checks the admin token before
 *    touching Supabase (no accidental unauthenticated route).
 *  - "Merchant isolation" stays enforced at the application layer on every mutation (PUT/DELETE):
 *    the route must look up the existing row and compare merchant_id before writing, since RLS
 *    on categories/products only covers public SELECT, not authenticated writes.
 *  - Deleting a category still moves its products to "uncategorized" instead of letting the
 *    DB's ON DELETE CASCADE on products.category_id silently delete them.
 *  - The client-side editor never imports the service-role Supabase client directly (writes
 *    must go through the authenticated API routes, not straight from the browser bundle).
 *  - The Menu tab is actually wired into the merchant editor, gated on an existing merchant id.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(relPath) {
  return readFile(new URL(`../${relPath}`, import.meta.url), "utf8");
}

const categoriesSource = await read("app/api/admin/menu-categories/route.ts");
const productsSource = await read("app/api/admin/menu-products/route.ts");
const editorSource = await read("app/admin/components/menu-editor.tsx");
const formSource = await read("app/admin/components/merchant-form.tsx");

function extractHandler(source, method) {
  const signature = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*request\\s*:\\s*NextRequest\\s*\\)\\s*\\{`);
  const match = signature.exec(source);
  const start = match?.index ?? -1;
  if (start === -1) return null;
  const nextHandler = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, nextHandler === -1 ? source.length : nextHandler);
}

/* ── Auth: every exported HTTP handler must check the admin token first ── */
for (const [label, source] of [
  ["menu-categories", categoriesSource],
  ["menu-products", productsSource],
]) {
  for (const method of ["GET", "POST", "PUT", "DELETE"]) {
    const handler = extractHandler(source, method);
    assert.ok(handler, `${label}: missing an exported ${method} handler`);
    assert.match(
      handler,
      /if \(!verifyToken\(request\)\)/,
      `${label}: ${method} handler must call verifyToken(request) before touching Supabase`,
    );
  }
}

/* ── Merchant isolation: PUT/DELETE must fetch the existing row and compare merchant_id ── */
for (const [label, source] of [
  ["menu-categories", categoriesSource],
  ["menu-products", productsSource],
]) {
  for (const method of ["PUT", "DELETE"]) {
    const body = extractHandler(source, method);
    assert.ok(body, `${label}: missing an exported ${method} handler body`);
    assert.match(
      body,
      /existing\.merchant_id !== merchantId/,
      `${label}: ${method} must reject when the existing row's merchant_id does not match the request's merchant_id`,
    );
    assert.match(
      body,
      /\.eq\(['"]merchant_id['"],\s*merchantId\)/,
      `${label}: ${method}'s actual mutation query must also be scoped with .eq('merchant_id', merchantId) as defense in depth`,
    );
  }
}

/* ── Category delete must not let ON DELETE CASCADE silently destroy products ── */
assert.match(
  categoriesSource,
  /update\(\{\s*category_id:\s*null\s*\}\)[\s\S]{0,40}\.eq\(['"]category_id['"],\s*id\)/,
  "menu-categories DELETE must null out category_id on affected products before deleting the category",
);
const deleteHandler = extractHandler(categoriesSource, "DELETE");
assert.ok(deleteHandler, "menu-categories: missing DELETE handler");
const nullOutIndex = deleteHandler.indexOf("category_id: null");
const deleteCallIndex = deleteHandler.indexOf("from('categories').delete()");
assert.ok(nullOutIndex !== -1 && deleteCallIndex !== -1 && nullOutIndex < deleteCallIndex,
  "menu-categories DELETE must null out product category_id BEFORE deleting the category row");

/* ── Cross-merchant category assignment must be rejected on product writes ── */
for (const method of ["POST", "PUT"]) {
  const handlerMatch = extractHandler(productsSource, method);
  assert.ok(handlerMatch, `menu-products: missing ${method} handler body`);
  assert.match(
    handlerMatch,
    /category\.merchant_id !== (body\.merchant_id|merchantId)/,
    `menu-products ${method} must reject a category_id that belongs to a different merchant`,
  );
}

/* ── The client editor must never import the service-role Supabase client directly ── */
assert.doesNotMatch(
  editorSource,
  /supabase-admin/,
  "menu-editor.tsx is a client component and must never import lib/supabase-admin directly",
);
assert.match(editorSource, /'use client'/, "menu-editor.tsx must be a client component");

/* ── The Menu tab must actually be wired into the merchant editor ── */
assert.match(formSource, /import MenuEditor from '\.\/menu-editor'/, "merchant-form.tsx must import MenuEditor");
assert.match(
  formSource,
  /isEditing && merchant[\s\S]{0,80}<MenuEditor merchantId=\{merchant\.id\} merchantName=\{merchant\.name\} \/>/,
  "merchant-form.tsx must only render MenuEditor once an existing merchant (with an id) is being edited",
);

console.log("menu editor safety checks passed");
