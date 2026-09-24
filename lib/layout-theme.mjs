/**
 * Layout theme tokens — the per-layout class strings used by the shared section components
 * (gallery, seasonal, reviews, appointment, events, share buttons, related merchants).
 *
 * Before this module each of those components kept its own `Record<LayoutKey, string>` maps, so a
 * new layout meant editing seven files. Now a layout supplies one theme object here and the
 * components read from it. Each layout file (app/layouts/*) still owns its own structure and its
 * own hero/menu/footer styling; only the shared sections are themed from here.
 *
 * Rules for values:
 *  - Every value is a complete, literal Tailwind class string. Never build one by concatenation
 *    or interpolation: Tailwind only generates CSS for class names it can find verbatim in the
 *    source, so a computed string would silently lose its styling in production.
 *  - The five original layouts are copied character for character from the maps they replaced;
 *    scripts/test-layout-theme.mjs pins those values so an accidental edit fails `verify`.
 *  - Slots are one-to-one with the old maps. Collapsing them into shared semantic roles would
 *    change colours (e.g. Classic's section background differs between gallery and reviews) and
 *    is out of scope here.
 *
 * Plain ESM like layout-registry.mjs, so the Node test can execute it; types are in
 * layout-theme.d.mts.
 */

import { DEFAULT_LAYOUT_KEY, isLayoutKey } from "./layout-registry.mjs";

/** The slot names every theme must provide, grouped by the component that reads them. */
export const LAYOUT_THEME_SLOTS = deepFreeze({
  gallery: ["sectionBg", "title"],
  seasonal: ["sectionBg", "card", "text", "badge"],
  reviews: ["sectionBg", "card", "text", "dotActive", "dotInactive", "arrow"],
  // `input` is only the colour part; the shared sizing/shape classes stay in the component.
  appointment: ["sectionBg", "card", "text", "input", "buttonPrimary", "successIcon"],
  events: ["sectionBg", "card", "text", "dateBadge"],
  share: ["button"],
  related: [
    "section",
    "title",
    "viewAll",
    "viewAllHover",
    "cardBg",
    "cardBorder",
    "cuisineTagBorder",
    "cuisineTagBg",
    "cuisineTagText",
    "areaTagBg",
    "areaTagText",
    "hoursText",
    "viewMenu",
    "viewMenuHover",
    "closedBadge",
  ],
});

export const LAYOUT_THEMES = deepFreeze({
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
});

/**
 * Theme for a layout key. Anything that is not a registered layout with a theme gets the default
 * (Classic) theme, matching the public store page's own fallback. Callers pass keys that have
 * already been resolved through the registry, so the fallback is a safety net, not a code path.
 */
export function getLayoutTheme(key) {
  return isLayoutKey(key) && Object.prototype.hasOwnProperty.call(LAYOUT_THEMES, key)
    ? LAYOUT_THEMES[key]
    : LAYOUT_THEMES[DEFAULT_LAYOUT_KEY];
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
