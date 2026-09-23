/* bitesite/lib/layout-registry.d.mts */

/**
 * Registered public store layout keys.
 *
 * This union, the runtime LAYOUT_KEYS export in layout-registry.mjs, and the component map in
 * app/layouts/index.ts must stay in lockstep. scripts/test-layout-registry.mjs asserts the first
 * two against each other and against the component map; `satisfies Record<LayoutKey, ...>` in
 * app/layouts/index.ts makes typecheck fail if a component is missing.
 */
export type LayoutKey = "classic" | "elegant" | "minimal" | "modern" | "rustic";

export type LayoutResolutionReason =
  | "ok"
  | "missing"
  | "empty"
  | "unknown"
  | "not_public_ready";

export interface LayoutMeta {
  readonly key: LayoutKey;
  readonly displayName: string;
  readonly shortDescription: string;
  readonly suitableCuisines: readonly string[];
  readonly productionReady: boolean;
  /** Display-only colour preview for selectors. Not a theme token source. */
  readonly swatches: readonly string[];
  readonly order: number;
}

export interface LayoutResolution {
  readonly key: LayoutKey;
  readonly fellBack: boolean;
  readonly reason: LayoutResolutionReason;
}

export interface LayoutLogDescriptor {
  readonly type: string;
  readonly value: string | null;
  readonly length: number | null;
}

export interface LayoutRegistryApi {
  readonly registry: Readonly<Record<string, LayoutMeta>>;
  readonly keys: readonly string[];
  readonly fallbackKey: string;
  isLayoutKey(value: unknown): boolean;
  isPersistableLayout(value: unknown): boolean;
  resolvePublicLayoutKey(value: unknown): { key: string; fellBack: boolean; reason: LayoutResolutionReason };
  resolveRegisteredLayoutKey(value: unknown): { key: string; fellBack: boolean; reason: LayoutResolutionReason };
  getLayoutMeta(value: unknown): LayoutMeta;
  getPersistableLayouts(): readonly LayoutMeta[];
}

export interface LayoutMetaInput {
  key: string;
  displayName: string;
  shortDescription: string;
  suitableCuisines: readonly string[];
  productionReady: boolean;
  swatches: readonly string[];
  order: number;
}

/** Test seam: builds an isolated registry (e.g. one containing an unfinished layout). */
export declare function createLayoutRegistry(
  entries: readonly LayoutMetaInput[],
  options?: { fallbackKey?: string },
): LayoutRegistryApi;

export declare const DEFAULT_LAYOUT_KEY: LayoutKey;
export declare const LAYOUT_KEYS: readonly LayoutKey[];
export declare const LAYOUT_REGISTRY: Readonly<Record<LayoutKey, LayoutMeta>>;

/** Registered in the registry at all — including layouts that are not production-ready yet. */
export declare function isLayoutKey(value: unknown): value is LayoutKey;

/** Registered AND production-ready: the only values that may be written to a merchant row. */
export declare function isPersistableLayout(value: unknown): value is LayoutKey;

/** Public store pages. Unknown, empty and not-yet-public-ready values resolve to Classic. */
export declare function resolvePublicLayoutKey(value: unknown): LayoutResolution;

/** Internal surfaces only (dev fixtures, Admin Preview). Never use on a public page. */
export declare function resolveRegisteredLayoutKey(value: unknown): LayoutResolution;

export declare function getLayoutMeta(value: unknown): LayoutMeta;

export declare function getPersistableLayouts(): readonly LayoutMeta[];

/** Sanitises an untrusted stored layout value for server logs. */
export declare function describeLayoutValueForLog(value: unknown): LayoutLogDescriptor;
