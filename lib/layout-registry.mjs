/**
 * Layout registry — the single source of truth for public store layout keys and their metadata.
 *
 * Kept as a small ESM module (same convention as lib/safe-json-ld.mjs) so that its regression
 * coverage in scripts/test-layout-registry.mjs can execute the exact resolvers the application
 * uses, rather than only asserting on source text. CI runs Node 20, which cannot execute
 * TypeScript directly; the accompanying layout-registry.d.mts carries the precise types.
 *
 * Two separate ideas, deliberately not merged:
 *  - "registered"       — the key exists in this registry at all.
 *  - "production-ready" — the layout is finished enough to be persisted onto a merchant row and
 *                         rendered on a public store page.
 * Writes (Admin now, Merchant self-service later) must use isPersistableLayout. The public store
 * page must use resolvePublicLayoutKey, so an unfinished layout can never reach a customer even
 * if a value is written straight into the database outside the API.
 */

const LOG_VALUE_MAX_LENGTH = 64;
/** C0 controls, DEL + C1 controls, and the two Unicode line/paragraph separators. */
const CONTROL_CHARS = new RegExp("[\u0000-\u001F\u007F-\u009F\u2028\u2029]", "g");

/** @type {readonly any[]} */
const LAYOUT_ENTRIES = [
  {
    key: "classic",
    displayName: "Classic",
    shortDescription: "Warm cafe / bakery",
    suitableCuisines: ["Cafe", "Bakery", "Local comfort food"],
    productionReady: true,
    swatches: ["#FFFBEB", "#FDE68A", "#92400E"],
    order: 1,
  },
  {
    key: "elegant",
    displayName: "Elegant",
    shortDescription: "Dark luxury fine-dining",
    suitableCuisines: ["Fine dining", "Steakhouse", "Cocktail bar"],
    productionReady: true,
    swatches: ["#020617", "#1E293B", "#FDE68A"],
    order: 2,
  },
  {
    key: "minimal",
    displayName: "Minimal",
    // Reworded in PR1A: the Japanese direction now belongs to its own dedicated layout.
    shortDescription: "Quiet editorial / Neutral",
    suitableCuisines: ["Specialty coffee", "Bakery", "Modern bistro"],
    productionReady: true,
    swatches: ["#FAFAF9", "#E7E5E4", "#292524"],
    order: 3,
  },
  {
    key: "modern",
    displayName: "Modern",
    shortDescription: "Contemporary urban",
    suitableCuisines: ["Fusion", "Brunch", "Dessert bar"],
    productionReady: true,
    swatches: ["#FFFFFF", "#F1F5F9", "#0F172A"],
    order: 4,
  },
  {
    key: "rustic",
    displayName: "Rustic",
    shortDescription: "Earthy farm-to-table",
    suitableCuisines: ["Farm-to-table", "Grill", "Family restaurant"],
    productionReady: true,
    swatches: ["#FFF7ED", "#FFEDD5", "#7C2D12"],
    order: 5,
  },
  {
    key: "chinese",
    displayName: "Chinese",
    shortDescription: "Red and gold heritage",
    suitableCuisines: ["Chinese", "Dim sum", "Kopitiam", "Tea house"],
    // Not public yet: renders only on internal surfaces until it is visually signed off.
    productionReady: false,
    swatches: ["#FDF6EC", "#991B1B", "#F59E0B"],
    order: 6,
  },
  {
    key: "malay",
    displayName: "Malay",
    shortDescription: "Songket green and gold",
    suitableCuisines: ["Malay", "Nasi campur", "Kuih and kopi", "Warung"],
    // Not public yet: renders only on internal surfaces until it is visually signed off.
    productionReady: false,
    swatches: ["#F8F6EF", "#065F46", "#F59E0B"],
    order: 7,
  },
];

function freezeEntry(entry) {
  return Object.freeze({
    key: entry.key,
    displayName: entry.displayName,
    shortDescription: entry.shortDescription,
    suitableCuisines: Object.freeze([...entry.suitableCuisines]),
    productionReady: entry.productionReady === true,
    swatches: Object.freeze([...entry.swatches]),
    order: entry.order,
  });
}

/**
 * Builds a registry instance and its resolvers. Exported so tests can exercise states the
 * production registry does not currently contain (notably a productionReady: false layout,
 * which only appears once new layouts land in PR2).
 */
export function createLayoutRegistry(entries, options = {}) {
  const fallbackKey = options.fallbackKey ?? "classic";
  /** @type {Record<string, any>} */
  const registry = Object.create(null);
  for (const entry of entries) {
    registry[entry.key] = freezeEntry(entry);
  }

  const keys = Object.freeze(
    entries.map((entry) => entry.key).sort((a, b) => registry[a].order - registry[b].order),
  );
  const keySet = new Set(keys);
  const persistableKeys = Object.freeze(keys.filter((key) => registry[key].productionReady));

  if (!keySet.has(fallbackKey)) {
    throw new Error(`Layout registry fallback key "${fallbackKey}" is not registered`);
  }
  if (!registry[fallbackKey].productionReady) {
    throw new Error(`Layout registry fallback key "${fallbackKey}" must be production-ready`);
  }

  // Frozen plain object for consumers; lookups below never use it as a dictionary, so
  // prototype-like strings ("__proto__", "constructor", "toString") can never match a layout.
  const publicRegistry = Object.freeze(
    Object.fromEntries(keys.map((key) => [key, registry[key]])),
  );

  function isLayoutKey(value) {
    return typeof value === "string" && keySet.has(value);
  }

  function isPersistableLayout(value) {
    return isLayoutKey(value) && registry[value].productionReady === true;
  }

  function classify(value) {
    if (value === null || value === undefined) return "missing";
    if (typeof value !== "string") return "unknown";
    if (value.trim() === "") return "empty";
    if (!keySet.has(value)) return "unknown";
    return registry[value].productionReady === true ? "ok" : "not_public_ready";
  }

  /** Public store pages: unfinished layouts fall back to the default, never render. */
  function resolvePublicLayoutKey(value) {
    const reason = classify(value);
    if (reason === "ok") return { key: value, fellBack: false, reason };
    return { key: fallbackKey, fellBack: true, reason };
  }

  /**
   * Internal surfaces only (dev fixtures, Admin Preview): a registered-but-unfinished layout
   * resolves to itself so it can be reviewed before release. Never use on a public path.
   */
  function resolveRegisteredLayoutKey(value) {
    const reason = classify(value);
    if (reason === "ok" || reason === "not_public_ready") {
      return { key: value, fellBack: false, reason: "ok" };
    }
    return { key: fallbackKey, fellBack: true, reason };
  }

  function getLayoutMeta(value) {
    return isLayoutKey(value) ? publicRegistry[value] : publicRegistry[fallbackKey];
  }

  function getPersistableLayouts() {
    return persistableKeys.map((key) => publicRegistry[key]);
  }

  return Object.freeze({
    registry: publicRegistry,
    keys,
    fallbackKey,
    isLayoutKey,
    isPersistableLayout,
    resolvePublicLayoutKey,
    resolveRegisteredLayoutKey,
    getLayoutMeta,
    getPersistableLayouts,
  });
}

const defaultRegistry = createLayoutRegistry(LAYOUT_ENTRIES, { fallbackKey: "classic" });

export const DEFAULT_LAYOUT_KEY = defaultRegistry.fallbackKey;
export const LAYOUT_KEYS = defaultRegistry.keys;
export const LAYOUT_REGISTRY = defaultRegistry.registry;

export function isLayoutKey(value) {
  return defaultRegistry.isLayoutKey(value);
}

export function isPersistableLayout(value) {
  return defaultRegistry.isPersistableLayout(value);
}

export function resolvePublicLayoutKey(value) {
  return defaultRegistry.resolvePublicLayoutKey(value);
}

export function resolveRegisteredLayoutKey(value) {
  return defaultRegistry.resolveRegisteredLayoutKey(value);
}

export function getLayoutMeta(value) {
  return defaultRegistry.getLayoutMeta(value);
}

export function getPersistableLayouts() {
  return defaultRegistry.getPersistableLayouts();
}

/**
 * Prepares an untrusted stored layout value for a server log line: strips control characters and
 * line breaks (so a crafted value cannot forge log entries), then truncates. Non-strings are
 * reported by type only.
 */
export function describeLayoutValueForLog(value) {
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (typeof value !== "string") {
    return { type, value: null, length: null };
  }
  const sanitized = value.replace(CONTROL_CHARS, "?");
  return {
    type,
    value: sanitized.slice(0, LOG_VALUE_MAX_LENGTH),
    length: value.length,
  };
}
