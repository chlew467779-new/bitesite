#!/usr/bin/env node
/**
 * Regression coverage for the layout theme tokens (lib/layout-theme.mjs).
 *
 * Same convention as the other scripts/test-*.mjs files: plain Node + node:assert, executing the
 * module itself and asserting on source text only for imports/structure in the consumers.
 *
 * What this guards against regressing:
 *  - The five original layouts keep exactly the class strings they had before the maps moved
 *    into one module (PRE_REFACTOR below is a frozen copy taken from main @ f713eac).
 *  - Every registered layout has a complete theme — a new layout cannot be half-added.
 *  - Values stay complete literal class strings, so Tailwind can still find them.
 *  - The shared section components read from the theme and no longer keep per-layout maps or
 *    hidden per-layout conditionals of their own.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LAYOUT_KEYS } from "../lib/layout-registry.mjs";
import { LAYOUT_THEMES, LAYOUT_THEME_SLOTS, getLayoutTheme } from "../lib/layout-theme.mjs";

async function read(relPath) {
  return readFile(new URL(`../${relPath}`, import.meta.url), "utf8");
}

/* ── the five original layouts are unchanged ───────────────────────────────────────────────── */

// Copied from the per-component maps as they were on main @ f713eac. Appointment `input` is the
// colour part only (the component still prefixes the shared sizing classes, as it always did);
// appointment `successIcon` replaces the old inline `variant === "elegant"` conditional.
// Editing a value here is a deliberate visual change to a live layout and needs review.
const PRE_REFACTOR = {
  classic: {
    gallery: {
      sectionBg: "bg-amber-50/60",
      title: "text-amber-900",
    },
    seasonal: {
      sectionBg: "bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50",
      card: "bg-white",
      text: "text-amber-900",
      badge: "bg-amber-500 text-white",
    },
    reviews: {
      sectionBg: "bg-white",
      card: "bg-amber-50/80 border-amber-200",
      text: "text-amber-900",
      dotActive: "bg-amber-700",
      dotInactive: "bg-amber-200",
      arrow: "bg-white border-amber-200 text-amber-900 hover:bg-amber-50",
    },
    appointment: {
      sectionBg: "bg-amber-50",
      card: "bg-white border-amber-200",
      text: "text-amber-900",
      input: "bg-white border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20",
      buttonPrimary: "bg-amber-700 hover:bg-amber-800",
      successIcon: "text-green-500",
    },
    events: {
      sectionBg: "bg-white",
      card: "bg-amber-50/50 border-amber-200",
      text: "text-amber-900",
      dateBadge: "bg-amber-700 text-white",
    },
    share: {
      button: "bg-white border-amber-200 text-amber-800 hover:bg-amber-50",
    },
    related: {
      section: "bg-amber-50/60 border-amber-200",
      title: "text-amber-900",
      viewAll: "text-amber-700",
      viewAllHover: "hover:text-amber-900",
      cardBg: "bg-white",
      cardBorder: "border-amber-100",
      cuisineTagBorder: "border-amber-200",
      cuisineTagBg: "bg-white",
      cuisineTagText: "text-amber-800/70",
      areaTagBg: "bg-[#5A8F6E]/10",
      areaTagText: "text-[#5A8F6E]",
      hoursText: "text-[#8A968B]",
      viewMenu: "text-[#5A8F6E]",
      viewMenuHover: "group-hover:text-[#4A7A5E]",
      closedBadge: "bg-stone-800/80 text-stone-300",
    },
  },
  elegant: {
    gallery: {
      sectionBg: "bg-slate-950",
      title: "text-amber-100",
    },
    seasonal: {
      sectionBg: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950",
      card: "bg-slate-800",
      text: "text-slate-100",
      badge: "bg-amber-500 text-slate-900",
    },
    reviews: {
      sectionBg: "bg-slate-900",
      card: "bg-slate-800 border-slate-700",
      text: "text-slate-200",
      dotActive: "bg-amber-400",
      dotInactive: "bg-slate-700",
      arrow: "bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700",
    },
    appointment: {
      sectionBg: "bg-slate-950",
      card: "bg-slate-900 border-slate-700",
      text: "text-slate-100",
      input: "bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20",
      buttonPrimary: "bg-amber-600 hover:bg-amber-700",
      successIcon: "text-amber-400",
    },
    events: {
      sectionBg: "bg-slate-900",
      card: "bg-slate-800 border-slate-700",
      text: "text-slate-100",
      dateBadge: "bg-amber-600 text-white",
    },
    share: {
      button: "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700",
    },
    related: {
      section: "bg-slate-950 border-slate-800",
      title: "text-slate-100",
      viewAll: "text-amber-400",
      viewAllHover: "hover:text-amber-300",
      cardBg: "bg-slate-900",
      cardBorder: "border-slate-800",
      cuisineTagBorder: "border-slate-700",
      cuisineTagBg: "bg-slate-800",
      cuisineTagText: "text-slate-400",
      areaTagBg: "bg-amber-500/20",
      areaTagText: "text-amber-400",
      hoursText: "text-slate-500",
      viewMenu: "text-amber-400",
      viewMenuHover: "group-hover:text-amber-300",
      closedBadge: "bg-slate-700 text-slate-300",
    },
  },
  minimal: {
    gallery: {
      sectionBg: "bg-stone-50",
      title: "text-stone-800",
    },
    seasonal: {
      sectionBg: "bg-gradient-to-br from-stone-100 via-stone-50 to-white",
      card: "bg-white",
      text: "text-stone-800",
      badge: "bg-stone-800 text-white",
    },
    reviews: {
      sectionBg: "bg-stone-100",
      card: "bg-white border-stone-200",
      text: "text-stone-700",
      dotActive: "bg-stone-800",
      dotInactive: "bg-stone-200",
      arrow: "bg-white border-stone-200 text-stone-800 hover:bg-stone-50",
    },
    appointment: {
      sectionBg: "bg-white",
      card: "bg-stone-50 border-stone-200",
      text: "text-stone-800",
      input: "bg-white border-stone-200 focus:border-stone-400 focus:ring-2 focus:ring-stone-400/20",
      buttonPrimary: "bg-stone-800 hover:bg-stone-900",
      successIcon: "text-green-500",
    },
    events: {
      sectionBg: "bg-stone-50",
      card: "bg-white border-stone-200",
      text: "text-stone-800",
      dateBadge: "bg-stone-800 text-white",
    },
    share: {
      button: "bg-white border-stone-200 text-stone-700 hover:bg-stone-50",
    },
    related: {
      section: "bg-stone-100 border-stone-200",
      title: "text-stone-800",
      viewAll: "text-stone-600",
      viewAllHover: "hover:text-stone-900",
      cardBg: "bg-white",
      cardBorder: "border-stone-200",
      cuisineTagBorder: "border-stone-200",
      cuisineTagBg: "bg-white",
      cuisineTagText: "text-stone-500",
      areaTagBg: "bg-stone-200",
      areaTagText: "text-stone-700",
      hoursText: "text-stone-400",
      viewMenu: "text-stone-700",
      viewMenuHover: "group-hover:text-stone-900",
      closedBadge: "bg-stone-700 text-stone-300",
    },
  },
  modern: {
    gallery: {
      sectionBg: "bg-white",
      title: "text-slate-900",
    },
    seasonal: {
      sectionBg: "bg-gradient-to-br from-slate-100 via-white to-slate-50",
      card: "bg-white",
      text: "text-slate-800",
      badge: "bg-slate-900 text-white",
    },
    reviews: {
      sectionBg: "bg-slate-50",
      card: "bg-white border-slate-200 shadow-sm",
      text: "text-slate-700",
      dotActive: "bg-slate-900",
      dotInactive: "bg-slate-200",
      arrow: "bg-white border-slate-200 text-slate-800 hover:bg-slate-50",
    },
    appointment: {
      sectionBg: "bg-slate-50",
      card: "bg-white border-slate-200 shadow-lg",
      text: "text-slate-800",
      input: "bg-white border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20",
      buttonPrimary: "bg-slate-900 hover:bg-slate-800",
      successIcon: "text-green-500",
    },
    events: {
      sectionBg: "bg-white",
      card: "bg-slate-50 border-slate-200",
      text: "text-slate-800",
      dateBadge: "bg-slate-900 text-white",
    },
    share: {
      button: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
    },
    related: {
      section: "bg-slate-50 border-slate-200",
      title: "text-slate-900",
      viewAll: "text-slate-700",
      viewAllHover: "hover:text-slate-900",
      cardBg: "bg-white",
      cardBorder: "border-slate-200",
      cuisineTagBorder: "border-slate-200",
      cuisineTagBg: "bg-white",
      cuisineTagText: "text-slate-500",
      areaTagBg: "bg-slate-200",
      areaTagText: "text-slate-700",
      hoursText: "text-slate-400",
      viewMenu: "text-slate-700",
      viewMenuHover: "group-hover:text-slate-900",
      closedBadge: "bg-slate-700 text-slate-300",
    },
  },
  rustic: {
    gallery: {
      sectionBg: "bg-orange-50/60",
      title: "text-orange-900",
    },
    seasonal: {
      sectionBg: "bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50",
      card: "bg-white",
      text: "text-orange-900",
      badge: "bg-orange-600 text-white",
    },
    reviews: {
      sectionBg: "bg-amber-50",
      card: "bg-white border-orange-200",
      text: "text-orange-900",
      dotActive: "bg-orange-700",
      dotInactive: "bg-orange-200",
      arrow: "bg-white border-orange-200 text-orange-900 hover:bg-orange-50",
    },
    appointment: {
      sectionBg: "bg-orange-50",
      card: "bg-white border-orange-200",
      text: "text-orange-900",
      input: "bg-white border-orange-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20",
      buttonPrimary: "bg-orange-700 hover:bg-orange-800",
      successIcon: "text-green-500",
    },
    events: {
      sectionBg: "bg-amber-50",
      card: "bg-white border-orange-200",
      text: "text-orange-900",
      dateBadge: "bg-orange-700 text-white",
    },
    share: {
      button: "bg-white border-orange-200 text-orange-800 hover:bg-orange-50",
    },
    related: {
      section: "bg-orange-50/60 border-orange-200",
      title: "text-orange-900",
      viewAll: "text-orange-700",
      viewAllHover: "hover:text-orange-900",
      cardBg: "bg-white",
      cardBorder: "border-orange-100",
      cuisineTagBorder: "border-orange-200",
      cuisineTagBg: "bg-white",
      cuisineTagText: "text-orange-600",
      areaTagBg: "bg-orange-200",
      areaTagText: "text-orange-800",
      hoursText: "text-orange-700/60",
      viewMenu: "text-orange-700",
      viewMenuHover: "group-hover:text-orange-800",
      closedBadge: "bg-stone-800/80 text-stone-300",
    },
  },
};

for (const [key, expected] of Object.entries(PRE_REFACTOR)) {
  assert.deepEqual(LAYOUT_THEMES[key], expected, `${key} renders exactly the class strings it had before PR2A`);
}

/* ── every registered layout has a complete theme ──────────────────────────────────────────── */

assert.deepEqual(
  Object.keys(LAYOUT_THEMES).sort(),
  [...LAYOUT_KEYS].sort(),
  "one theme per registered layout — no missing and no orphan themes",
);

const slotCount = Object.values(LAYOUT_THEME_SLOTS).reduce((sum, slots) => sum + slots.length, 0);
assert.equal(slotCount, 38, "38 slots: one per style map entry the shared sections used before");

for (const key of LAYOUT_KEYS) {
  const theme = LAYOUT_THEMES[key];
  assert.deepEqual(Object.keys(theme), Object.keys(LAYOUT_THEME_SLOTS), `${key} has exactly the theme groups`);
  for (const [group, slots] of Object.entries(LAYOUT_THEME_SLOTS)) {
    assert.deepEqual(Object.keys(theme[group]), [...slots], `${key}.${group} has exactly the expected slots`);
    for (const slot of slots) {
      const value = theme[group][slot];
      assert.equal(typeof value, "string", `${key}.${group}.${slot} is a string`);
      assert.ok(value.trim() === value && value.length > 0, `${key}.${group}.${slot} is non-empty and trimmed`);
      // Class tokens only: no interpolation leftovers, quotes, or doubled spaces.
      assert.match(value, /^[A-Za-z0-9:\-/[\]#.%]+( [A-Za-z0-9:\-/[\]#.%]+)*$/, `${key}.${group}.${slot} is a plain class list`);
    }
  }
}

assert.ok(Object.isFrozen(LAYOUT_THEMES), "the theme table is frozen");
assert.ok(Object.isFrozen(LAYOUT_THEMES.classic.related), "…all the way down");
assert.ok(Object.isFrozen(LAYOUT_THEME_SLOTS.related), "the slot list is frozen too");

/* ── the .d.mts types list the same slots ──────────────────────────────────────────────────── */

const declarations = await read("lib/layout-theme.d.mts");
const INTERFACE_FOR_GROUP = {
  gallery: "GalleryTheme",
  seasonal: "SeasonalTheme",
  reviews: "ReviewsTheme",
  appointment: "AppointmentTheme",
  events: "EventsTheme",
  share: "ShareTheme",
  related: "RelatedMerchantsTheme",
};
assert.deepEqual(Object.keys(INTERFACE_FOR_GROUP), Object.keys(LAYOUT_THEME_SLOTS), "every group has an interface");
for (const [group, name] of Object.entries(INTERFACE_FOR_GROUP)) {
  const body = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(declarations);
  assert.ok(body, `${name} is declared`);
  const fields = [...body[1].matchAll(/readonly (\w+): string;/g)].map((match) => match[1]);
  assert.deepEqual(fields, [...LAYOUT_THEME_SLOTS[group]], `${name} declares exactly the ${group} slots`);
  assert.match(declarations, new RegExp(`readonly ${group}: ${name};`), `LayoutTheme.${group} is typed as ${name}`);
}

/* ── values are literals Tailwind can see ──────────────────────────────────────────────────── */

const themeSource = await read("lib/layout-theme.mjs");
const table = /export const LAYOUT_THEMES = deepFreeze\(\{([\s\S]*?)\n\}\);/.exec(themeSource);
assert.ok(table, "the theme table is a single object literal");
assert.doesNotMatch(table[1], /\$\{|`|\+|\.\.\./, "no interpolation, concatenation or spreading inside the theme table");
for (const key of LAYOUT_KEYS) {
  for (const group of Object.values(LAYOUT_THEMES[key])) {
    for (const value of Object.values(group)) {
      assert.ok(table[1].includes(JSON.stringify(value)), `"${value}" appears verbatim in the source`);
    }
  }
}

/* ── lookups ───────────────────────────────────────────────────────────────────────────────── */

for (const key of LAYOUT_KEYS) {
  assert.equal(getLayoutTheme(key), LAYOUT_THEMES[key], `${key} resolves to its own theme`);
}
for (const value of [undefined, null, "", "Classic", "unknown", "__proto__", "constructor", "toString", 42, {}]) {
  assert.equal(getLayoutTheme(value), LAYOUT_THEMES.classic, `${String(value)} falls back to the Classic theme`);
}

/* ── the shared sections read from the theme ───────────────────────────────────────────────── */

const THEMED_COMPONENTS = {
  "app/components/sections/gallery-section.tsx": "gallery",
  "app/components/sections/seasonal-section.tsx": "seasonal",
  "app/components/sections/reviews-section.tsx": "reviews",
  "app/components/sections/appointment-section.tsx": "appointment",
  "app/components/sections/events-section.tsx": "events",
};
for (const [relPath, group] of Object.entries(THEMED_COMPONENTS)) {
  const source = await read(relPath);
  assert.match(
    source,
    /import \{ getLayoutTheme \} from "@\/lib\/layout-theme\.mjs";/,
    `${relPath} imports the shared theme`,
  );
  assert.match(
    source,
    new RegExp(`const theme = getLayoutTheme\\(variant\\)\\.${group};`),
    `${relPath} reads the ${group} theme group`,
  );
  assert.doesNotMatch(source, /Record<(LayoutVariant|LayoutKey)/, `${relPath} keeps no per-layout map of its own`);
  assert.doesNotMatch(source, /\[variant\]/, `${relPath} does not index anything by layout key`);
  assert.doesNotMatch(source, /variant\s*[!=]==/, `${relPath} has no hidden per-layout branch`);
  for (const slot of LAYOUT_THEME_SLOTS[group]) {
    assert.ok(source.includes(`theme.${slot}`), `${relPath} uses the ${group}.${slot} slot`);
  }
}

// The appointment input keeps its shared sizing/shape classes in front of the themed colours,
// which is exactly the string the old per-layout map produced.
const appointmentSource = await read("app/components/sections/appointment-section.tsx");
assert.match(
  appointmentSource,
  /const inputBase = "w-full px-4 py-3 rounded-xl border outline-none transition-all duration-200 text-base";/,
  "the shared input classes are unchanged",
);
assert.match(appointmentSource, /const inputStyles = `\$\{inputBase\} \$\{theme\.input\}`;/, "…and still come first");

// Share buttons and related merchants sit outside the tier sections but follow the same rule.
const OTHER_THEMED = {
  "components/sections/share-buttons.tsx": /const buttonStyles = getLayoutTheme\(variant\)\.share\.button;/,
  "components/sections/related-merchants.tsx": /const s = getLayoutTheme\(variant\)\.related;/,
};
for (const [relPath, lookup] of Object.entries(OTHER_THEMED)) {
  const source = await read(relPath);
  assert.match(source, /import \{ getLayoutTheme \} from "@\/lib\/layout-theme\.mjs";/, `${relPath} imports the shared theme`);
  assert.match(source, lookup, `${relPath} reads its theme group`);
  assert.doesNotMatch(source, /Record<(LayoutVariant|LayoutKey)/, `${relPath} keeps no per-layout map of its own`);
  assert.doesNotMatch(source, /\[variant\]/, `${relPath} does not index anything by layout key`);
  assert.doesNotMatch(source, /variant\s*[!=]==/, `${relPath} has no hidden per-layout branch`);
}
const relatedSource = await read("components/sections/related-merchants.tsx");
for (const slot of LAYOUT_THEME_SLOTS.related) {
  assert.ok(relatedSource.includes(`s.${slot}`), `related-merchants uses the related.${slot} slot`);
}

console.log("layout theme checks passed");
