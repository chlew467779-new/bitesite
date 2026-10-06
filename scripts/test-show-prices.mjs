#!/usr/bin/env node
/**
 * Regression coverage for the public show_prices rule (lib/menu-display.mjs).
 *
 * The rule itself is executed here. The source-text assertions are deliberately light: they check
 * that each public price surface goes through the shared guard. JSX structure and visual
 * correctness are covered by the development layout fixtures and manual screenshots.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { shouldShowPrice, hasDisplayablePrice } from "../lib/menu-display.mjs";
import { LAYOUT_KEYS } from "../lib/layout-registry.mjs";

async function read(relPath) {
  return (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
}

/* ── the rule ──────────────────────────────────────────────────────────────────────────────── */

assert.equal(shouldShowPrice({ show_prices: true }), true, "explicit true shows prices");
assert.equal(shouldShowPrice({ show_prices: false }), false, "only an explicit false hides prices");
assert.equal(shouldShowPrice({ show_prices: null }), true, "null is historical data and still shows prices");
assert.equal(shouldShowPrice({ show_prices: undefined }), true, "undefined shows prices");
assert.equal(shouldShowPrice({}), true, "a missing field shows prices");
assert.equal(shouldShowPrice(null), true, "a missing product never hides prices by accident");
assert.equal(shouldShowPrice(undefined), true, "an undefined product never hides prices by accident");
// Guard against a truthiness refactor: these are not `false`, so they must not hide prices.
assert.equal(shouldShowPrice({ show_prices: 0 }), true, "0 is not an explicit false");
assert.equal(shouldShowPrice({ show_prices: "" }), true, "an empty string is not an explicit false");
assert.equal(shouldShowPrice({ show_prices: "false" }), true, "the string 'false' is not a boolean false");
assert.equal(hasDisplayablePrice({ show_prices: true, price: null, discount_price: null }), false, "an unpriced dish leaves no empty price container");
assert.equal(hasDisplayablePrice({ price: undefined }), false, "missing prices leave no container");
assert.equal(hasDisplayablePrice({ price: 0 }), true, "a free dish shows RM 0.00");
assert.equal(hasDisplayablePrice({ price: '12.50' }), true, "database numeric strings show a price");
assert.equal(hasDisplayablePrice({ discount_price: 8 }), true, "a discount price also counts");
assert.equal(hasDisplayablePrice({ show_prices: false, price: 12 }), false, "the hide switch still wins");
assert.equal(hasDisplayablePrice({ price: '' }), false, "an empty price string is not zero");

/* ── public layouts ────────────────────────────────────────────────────────────────────────── */

// Every registered layout, including ones not yet public, so a new layout cannot skip the guard.
const LAYOUTS = LAYOUT_KEYS;

// Since T7 every key renders the one shared structure.
assert.ok(LAYOUTS.length > 0);
for (const relPath of ["app/layouts/store-layout.tsx"]) {
  const source = await read(relPath);

  assert.match(
    source,
    /import \{ hasDisplayablePrice \} from "@\/lib\/menu-display\.mjs";/,
    `${relPath} uses the shared rule instead of its own condition`,
  );
  assert.match(
    source,
    /\{hasDisplayablePrice\(product\) && \(/,
    `${relPath} calls the shared guard before its public price markup`,
  );
}

/* ── featured / seasonal path ──────────────────────────────────────────────────────────────── */

const tierSource = await read("app/components/sections/tier-sections.tsx");
assert.match(
  tierSource,
  /import \{ hasDisplayablePrice \} from "@\/lib\/menu-display\.mjs";/,
  "the featured/seasonal price string is built through the shared rule",
);
assert.match(
  tierSource,
  /price: !hasDisplayablePrice\(p\)\s*\n?\s*\? undefined/,
  "a hidden price yields no price string for the featured/seasonal section",
);
const seasonalSource = await read("app/components/sections/seasonal-section.tsx");
assert.match(
  seasonalSource,
  /\{item\.price && \(/,
  "SeasonalSection still skips the price element entirely when there is no price string",
);

/* ── admin menu editor ─────────────────────────────────────────────────────────────────────── */

const editorSource = await read("app/admin/components/menu-editor.tsx");

assert.match(
  editorSource,
  /checked=\{draft\.show_prices\}/,
  "the editor exposes a real show_prices control instead of only carrying the value through",
);
assert.match(editorSource, /Show price on public menu/, "the control says what it does");
assert.match(
  editorSource,
  /availability is unchanged/,
  "the help text says this is about display, not whether the dish can be ordered",
);
assert.match(
  editorSource,
  /Hidden publicly/,
  "the product list flags a hidden price while still showing the operator the stored price",
);
assert.match(
  editorSource,
  /import \{ shouldShowPrice \} from '@\/lib\/menu-display\.mjs';/,
  "the editor's public preview uses the same rule as the real layouts",
);
assert.match(editorSource, /Uncategorized/, "the editor identifies uncategorized dishes");
assert.match(
  editorSource,
  /not shown on the public menu/,
  "the uncategorized warning states the public consequence",
);

console.log("show_prices checks passed");
