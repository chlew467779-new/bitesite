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
import { shouldShowPrice } from "../lib/menu-display.mjs";

async function read(relPath) {
  return readFile(new URL(`../${relPath}`, import.meta.url), "utf8");
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

/* ── public layouts ────────────────────────────────────────────────────────────────────────── */

const LAYOUTS = ["classic", "elegant", "minimal", "modern", "rustic"];

for (const layout of LAYOUTS) {
  const relPath = `app/layouts/${layout}-layout.tsx`;
  const source = await read(relPath);

  assert.match(
    source,
    /import \{ shouldShowPrice \} from "@\/lib\/menu-display\.mjs";/,
    `${relPath} uses the shared rule instead of its own condition`,
  );
  assert.match(
    source,
    /\{shouldShowPrice\(product\) && \(/,
    `${relPath} calls the shared guard before its public price markup`,
  );
}

/* ── featured / seasonal path ──────────────────────────────────────────────────────────────── */

const tierSource = await read("app/components/sections/tier-sections.tsx");
assert.match(
  tierSource,
  /import \{ shouldShowPrice \} from "@\/lib\/menu-display\.mjs";/,
  "the featured/seasonal price string is built through the shared rule",
);
assert.match(
  tierSource,
  /price: !shouldShowPrice\(p\)\s*\n?\s*\? undefined/,
  "a hidden price yields no price string for the featured/seasonal section",
);
const seasonalSource = await read("app/components/sections/seasonal-section.tsx");
assert.match(
  seasonalSource,
  /\{item\.price && \(/,
  "SeasonalSection still skips the price element entirely when there is no price string",
);

// components/sections/tier-sections.tsx is a dead duplicate (nothing imports it) and is tracked
// as OQ-LegacyStyle for a separate cleanup PR, so it is intentionally not updated here.
const deadDuplicate = await read("components/sections/tier-sections.tsx");
assert.doesNotMatch(
  deadDuplicate,
  /shouldShowPrice/,
  "the dead duplicate stays untouched; cleaning it up belongs to the legacy cleanup PR",
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
