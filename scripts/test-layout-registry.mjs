#!/usr/bin/env node
/**
 * Regression coverage for the layout registry (lib/layout-registry.mjs).
 *
 * This repo has no jest/vitest — coverage follows the same convention as
 * scripts/test-safe-json-ld.mjs and scripts/test-menu-editor-safety.mjs. Because the registry is
 * a plain ESM module, the resolvers below are *executed*, not just pattern-matched; source-text
 * assertions are limited to checking that key guards/calls exist in the files that consume them.
 *
 * What this guards against regressing:
 *  - Layout keys, display metadata and production-readiness stay in one place and stay frozen.
 *  - Writes only ever accept registered, production-ready layouts (no unfinished theme can be
 *    persisted onto a merchant row by Admin or, later, by merchant self-service).
 *  - Public store pages fall back to Classic for unknown/blank/not-public-ready values instead of
 *    404ing, and never resolve a prototype-chain property ("__proto__", "toString", ...).
 *  - Log output for an untrusted stored value is stripped of control characters and truncated.
 *  - The runtime key list, the LayoutKey union in the .d.mts, and the component map in
 *    app/layouts/index.ts cannot drift apart when a new layout is added.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_LAYOUT_KEY,
  LAYOUT_KEYS,
  LAYOUT_REGISTRY,
  createLayoutRegistry,
  describeLayoutValueForLog,
  getLayoutMeta,
  getPersistableLayouts,
  isLayoutKey,
  isPersistableLayout,
  resolvePublicLayoutKey,
  resolveRegisteredLayoutKey,
} from "../lib/layout-registry.mjs";

async function read(relPath) {
  return readFile(new URL(`../${relPath}`, import.meta.url), "utf8");
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Values that must never resolve to a layout: prototype members, wrong case, junk types. */
const NON_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "hasOwnProperty",
  "valueOf",
  "Classic",
  " classic ",
  "classic\n",
  "japanese",
  "muji",
  "<script>",
  0,
  1,
  123,
  true,
  false,
  {},
  [],
  () => {},
  Symbol("classic"),
];

/* ── registry shape ────────────────────────────────────────────────────────────────────────── */

// Layouts customers can see, and registered layouts still waiting for visual sign-off. A new
// layout lands in UNFINISHED (productionReady: false) and moves across in its own small PR.
const PRODUCTION_READY = ["classic", "elegant", "minimal", "modern", "rustic"];
const UNFINISHED = ["chinese", "malay"];

assert.deepEqual(
  [...LAYOUT_KEYS],
  [...PRODUCTION_READY, ...UNFINISHED],
  "exactly these layouts are registered, in registry order (new keys arrive with their components)",
);
for (const key of LAYOUT_KEYS) {
  assert.equal(
    LAYOUT_REGISTRY[key].productionReady,
    PRODUCTION_READY.includes(key),
    `${key}: productionReady matches the list above`,
  );
}
assert.equal(DEFAULT_LAYOUT_KEY, "classic", "classic is the fallback layout");

const orders = new Set();
for (const key of LAYOUT_KEYS) {
  const meta = LAYOUT_REGISTRY[key];
  assert.ok(meta, `registry has an entry for ${key}`);
  assert.equal(meta.key, key, `${key}: entry key matches its registry key`);
  assert.ok(meta.displayName.trim().length > 0, `${key}: has a display name`);
  assert.ok(meta.shortDescription.trim().length > 0, `${key}: has a short description`);
  assert.ok(meta.suitableCuisines.length > 0, `${key}: lists suitable cuisines`);
  assert.equal(typeof meta.productionReady, "boolean", `${key}: productionReady is a boolean`);
  assert.ok(meta.swatches.length >= 2, `${key}: has preview swatches`);
  for (const swatch of meta.swatches) {
    assert.match(swatch, HEX, `${key}: swatch ${swatch} is a 6-digit hex colour`);
  }
  assert.equal(typeof meta.order, "number", `${key}: has a numeric order`);
  assert.ok(!orders.has(meta.order), `${key}: order ${meta.order} is unique`);
  orders.add(meta.order);
}

// Minimal was reworded in PR1A so the Japanese direction belongs to its own future layout.
const minimalCopy = `${LAYOUT_REGISTRY.minimal.shortDescription} ${LAYOUT_REGISTRY.minimal.suitableCuisines.join(" ")}`;
assert.doesNotMatch(minimalCopy, /japan/i, "minimal copy no longer claims the Japanese direction");

/* ── deep freezing ─────────────────────────────────────────────────────────────────────────── */

assert.ok(Object.isFrozen(LAYOUT_REGISTRY), "registry object is frozen");
assert.ok(Object.isFrozen(LAYOUT_KEYS), "key list is frozen");
for (const key of LAYOUT_KEYS) {
  const meta = LAYOUT_REGISTRY[key];
  assert.ok(Object.isFrozen(meta), `${key}: entry is frozen`);
  assert.ok(Object.isFrozen(meta.suitableCuisines), `${key}: suitableCuisines array is frozen`);
  assert.ok(Object.isFrozen(meta.swatches), `${key}: swatches array is frozen`);
}
assert.throws(
  () => {
    "use strict";
    LAYOUT_REGISTRY.classic.displayName = "mutated";
  },
  TypeError,
  "registry entries reject mutation in strict mode",
);

/* ── key predicates ────────────────────────────────────────────────────────────────────────── */

for (const key of LAYOUT_KEYS) {
  assert.ok(isLayoutKey(key), `${key} is a registered key`);
}
for (const key of PRODUCTION_READY) {
  assert.ok(isPersistableLayout(key), `${key} is persistable`);
}
for (const key of UNFINISHED) {
  assert.ok(!isPersistableLayout(key), `${key} is not finished, so it can never be written to a merchant row`);
}
for (const value of [...NON_KEYS, null, undefined, ""]) {
  assert.ok(!isLayoutKey(value), `${String(value)} is not a registered key`);
  assert.ok(!isPersistableLayout(value), `${String(value)} is not persistable`);
}

/* ── public resolver ───────────────────────────────────────────────────────────────────────── */

for (const key of PRODUCTION_READY) {
  assert.deepEqual(
    resolvePublicLayoutKey(key),
    { key, fellBack: false, reason: "ok" },
    `${key} resolves to itself on a public page`,
  );
}
for (const key of UNFINISHED) {
  assert.deepEqual(
    resolvePublicLayoutKey(key),
    { key: "classic", fellBack: true, reason: "not_public_ready" },
    `${key} never renders on a public page, even if written straight to the database`,
  );
}
for (const value of [null, undefined]) {
  assert.deepEqual(
    resolvePublicLayoutKey(value),
    { key: "classic", fellBack: true, reason: "missing" },
    "null/undefined is the ordinary default, reported as missing (callers stay silent)",
  );
}
for (const value of ["", "   ", "\t\n"]) {
  assert.equal(resolvePublicLayoutKey(value).reason, "empty", `${JSON.stringify(value)} is bad data, not a default`);
  assert.equal(resolvePublicLayoutKey(value).key, "classic");
}
for (const value of NON_KEYS) {
  const resolution = resolvePublicLayoutKey(value);
  assert.equal(resolution.key, "classic", `${String(value)} falls back to classic`);
  assert.equal(resolution.fellBack, true);
  assert.equal(resolution.reason, "unknown", `${String(value)} is reported as unknown`);
}

/* ── metadata lookup ───────────────────────────────────────────────────────────────────────── */

assert.equal(getLayoutMeta("elegant").displayName, "Elegant");
for (const value of [...NON_KEYS, null, undefined, ""]) {
  assert.equal(getLayoutMeta(value).key, "classic", `${String(value)} falls back to classic metadata`);
}
assert.deepEqual(
  getPersistableLayouts().map((meta) => meta.key),
  PRODUCTION_READY,
  "only production-ready layouts are offered as choices, ordered by their registry order",
);

/* ── synthetic registry: an unfinished layout (the PR2 state, tested now) ──────────────────── */

const synthetic = createLayoutRegistry(
  [
    {
      key: "classic",
      displayName: "Classic",
      shortDescription: "fallback",
      suitableCuisines: ["Cafe"],
      productionReady: true,
      swatches: ["#FFFBEB", "#92400E"],
      order: 1,
    },
    {
      key: "workinprogress",
      displayName: "Work In Progress",
      shortDescription: "not finished",
      suitableCuisines: ["Anything"],
      productionReady: false,
      swatches: ["#FFFFFF", "#000000"],
      order: 2,
    },
  ],
  { fallbackKey: "classic" },
);

assert.ok(synthetic.isLayoutKey("workinprogress"), "an unfinished layout is still registered");
assert.ok(
  !synthetic.isPersistableLayout("workinprogress"),
  "an unfinished layout can never be written to a merchant row",
);
assert.deepEqual(
  synthetic.resolvePublicLayoutKey("workinprogress"),
  { key: "classic", fellBack: true, reason: "not_public_ready" },
  "an unfinished layout never renders on a public page, even if written straight to the database",
);
assert.deepEqual(
  synthetic.resolveRegisteredLayoutKey("workinprogress"),
  { key: "workinprogress", fellBack: false, reason: "ok" },
  "internal surfaces (dev fixtures, Admin Preview) can still render an unfinished layout",
);
assert.deepEqual(
  synthetic.resolveRegisteredLayoutKey("nope"),
  { key: "classic", fellBack: true, reason: "unknown" },
  "internal resolver still rejects unregistered values",
);
assert.deepEqual(
  synthetic.getPersistableLayouts().map((meta) => meta.key),
  ["classic"],
  "selectors only offer production-ready layouts",
);
assert.throws(
  () => createLayoutRegistry([{ key: "wip", displayName: "W", shortDescription: "w", suitableCuisines: ["x"], productionReady: false, swatches: ["#FFFFFF", "#000000"], order: 1 }], { fallbackKey: "wip" }),
  /production-ready/,
  "the fallback layout itself must be production-ready",
);

// Internal surfaces (dev fixtures, Admin Preview) render every registered layout, finished or not.
for (const key of LAYOUT_KEYS) {
  assert.deepEqual(resolveRegisteredLayoutKey(key), { key, fellBack: false, reason: "ok" });
}

/* ── log sanitisation ──────────────────────────────────────────────────────────────────────── */

const injected = `classic\n[layout] forged line\r\u0000\u001b[31m${String.fromCharCode(0x2028)}end`;
const described = describeLayoutValueForLog(injected);
assert.equal(described.type, "string");
assert.doesNotMatch(
  described.value,
  new RegExp("[\\n\\r\\u0000\\u001b\\u2028\\u2029]"),
  "control characters are stripped from logs",
);
assert.equal(described.length, injected.length, "the original length is still reported");
const long = describeLayoutValueForLog("x".repeat(500));
assert.equal(long.value.length, 64, "long values are truncated");
assert.equal(long.length, 500);
assert.deepEqual(describeLayoutValueForLog(null), { type: "null", value: null, length: null });
assert.deepEqual(describeLayoutValueForLog(undefined), { type: "undefined", value: null, length: null });
assert.deepEqual(describeLayoutValueForLog(42), { type: "number", value: null, length: null });
assert.deepEqual(describeLayoutValueForLog({ layout: "classic" }), { type: "object", value: null, length: null });
assert.deepEqual(describeLayoutValueForLog(["classic"]), { type: "array", value: null, length: null });

/* ── runtime / declaration / component-map consistency ─────────────────────────────────────── */

const declarationSource = await read("lib/layout-registry.d.mts");
const unionMatch = /export type LayoutKey =([^;]+);/.exec(declarationSource);
assert.ok(unionMatch, "layout-registry.d.mts declares a LayoutKey union");
const declaredKeys = [...unionMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(
  [...declaredKeys].sort(),
  [...LAYOUT_KEYS].sort(),
  "the LayoutKey union in the .d.mts matches the runtime LAYOUT_KEYS exactly",
);

const layoutsIndexSource = await read("app/layouts/index.ts");
assert.match(
  layoutsIndexSource,
  /satisfies Record<LayoutKey,/,
  "the component map is checked against LayoutKey at compile time",
);
const mapBody = /export const layouts = \{([\s\S]*?)\} satisfies/.exec(layoutsIndexSource);
assert.ok(mapBody, "app/layouts/index.ts exports a layouts map");
const mappedKeys = [...mapBody[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((match) => match[1]);
assert.deepEqual(
  [...mappedKeys].sort(),
  [...LAYOUT_KEYS].sort(),
  "every registered layout has a component, and no component is registered twice",
);

/* ── consumers: key guards exist where they matter ─────────────────────────────────────────── */

const storePageSource = await read("app/store/[merchant]/page.tsx");
assert.match(storePageSource, /resolvePublicLayoutKey\(merchant\.layout\)/, "the store page resolves through the public resolver");
assert.match(storePageSource, /describeLayoutValueForLog\(merchant\.layout\)/, "the store page sanitises the value it logs");
assert.doesNotMatch(
  storePageSource,
  /resolveRegisteredLayoutKey/,
  "the store page must never use the internal resolver (it would publish unfinished layouts)",
);
assert.doesNotMatch(
  storePageSource,
  /if \(!LayoutComponent\) notFound\(\)/,
  "an unknown layout no longer 404s the storefront",
);

const merchantsCrudSource = await read("app/api/admin/merchants-crud/route.ts");
assert.match(
  merchantsCrudSource,
  /body\.layout !== undefined && !isPersistableLayout\(body\.layout\)/,
  "the admin merchants API whitelists layout writes against the registry",
);
assert.match(merchantsCrudSource, /from '@\/lib\/layout-registry\.mjs'/, "…using the shared registry, not a local copy");

/* ── admin surfaces read the registry and never resubmit an invalid stored value ───────────── */

const merchantFormSource = await read("app/admin/components/merchant-form.tsx");
assert.match(
  merchantFormSource,
  /const LAYOUTS = getPersistableLayouts\(\)/,
  "the admin layout selector lists registry layouts, so unfinished ones are never offered",
);
assert.doesNotMatch(
  merchantFormSource,
  /value: 'classic', label: 'Classic'/,
  "the hand-maintained LAYOUTS array is gone",
);
assert.match(
  merchantFormSource,
  /if \(isPersistableLayout\(form\.layout\)\) \{\s*payload\.layout = form\.layout;/,
  "layout is only submitted when it is a value the API will accept",
);
assert.doesNotMatch(
  merchantFormSource,
  /^\s*layout: form\.layout,$/m,
  "layout is no longer unconditionally part of the save payload",
);
assert.match(
  merchantFormSource,
  /layout: merchant\.layout \?\? 'classic'/,
  "a blank stored layout stays visible as bad data instead of being normalised to classic",
);
assert.match(merchantFormSource, /Unknown saved layout\./, "operators are told when a stored layout is unknown");
assert.match(merchantFormSource, /not yet public-ready/, "operators are told when a stored layout is not public-ready");

const merchantManagerSource = await read("app/admin/components/merchant-manager.tsx");
assert.doesNotMatch(
  merchantManagerSource,
  /classic: 'Classic',\s*elegant: 'Elegant'/,
  "the merchant list no longer keeps its own copy of the layout labels",
);
assert.match(merchantManagerSource, /getLayoutMeta\(layout\)\.displayName/, "…it reads labels from the registry");
assert.match(merchantManagerSource, /renders as Classic/, "…and flags stored values the public page will not honour");

/* ── no hand-written layout unions left in live code ───────────────────────────────────────── */

// The two files below are dead duplicates (nothing imports them); they are left untouched here
// and are tracked separately as a cleanup finding.
const DEAD_DUPLICATES = ["components/sections/tier-sections.tsx", "components/sections/appointment-section.tsx"];
const LIVE_VARIANT_FILES = [
  "app/components/sections/gallery-section.tsx",
  "components/sections/share-buttons.tsx",
  "components/sections/related-merchants.tsx",
  "app/store/[merchant]/page.tsx",
  "app/admin/components/merchant-form.tsx",
  "app/admin/components/merchant-manager.tsx",
];
for (const relPath of LIVE_VARIANT_FILES) {
  const source = await read(relPath);
  assert.doesNotMatch(
    source,
    /"classic"\s*\|\s*"elegant"/,
    `${relPath} must take layout keys from the registry instead of re-declaring them`,
  );
}
for (const relPath of DEAD_DUPLICATES) {
  const source = await read(relPath);
  assert.match(source, /type LayoutVariant/, `${relPath} is still the known dead duplicate (cleanup tracked separately)`);
}

console.log("layout registry checks passed");
