export type DiscoveryKind = "area" | "cuisine";
type DiscoveryMerchant = { name?: string | null; area?: string | null; cuisine?: string[] | null; cuisine_type?: string | null };

export interface DiscoveryGroup {
  slug: string;
  label: string;
  count: number;
  indexable: boolean;
}

export declare const MIN_INDEXABLE: number;
export declare const DISCOVERY_KINDS: readonly DiscoveryKind[];
export declare function discoverySlug(label: unknown): string;
export declare function merchantArea(merchant: DiscoveryMerchant | null | undefined): string | null;
export declare function merchantCuisines(merchant: DiscoveryMerchant | null | undefined): string[];
export declare function discoveryGroups(kind: DiscoveryKind, merchants: readonly DiscoveryMerchant[] | null | undefined): DiscoveryGroup[];
export declare function discoveryLanding<T extends DiscoveryMerchant>(
  kind: DiscoveryKind | string,
  slug: string,
  merchants: readonly T[] | null | undefined,
): { slug: string; label: string; merchants: T[]; indexable: boolean } | null;
export declare function discoveryPath(kind: DiscoveryKind, slug: string): string;
export declare function discoveryCopy(kind: DiscoveryKind, label: string, count: number): { title: string; heading: string; description: string };
