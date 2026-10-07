export declare function shortTime(minutesOfDay: number): string;
export declare function openStatus(
  todayHours: string | null | undefined,
  nowMinutes: number
): { open: boolean; label: string } | null;
export declare function openStatusParts(
  todayHours: string | null | undefined,
  nowMinutes: number
): { open: boolean; kind: "openUntil" | "opensAt" | "closedNow" | "closedToday"; minutes: number | null } | null;
export declare function malaysiaMinutes(date?: Date): number;
export declare function priceRange(
  products: ReadonlyArray<{ price?: unknown; discount_price?: unknown; show_prices?: boolean | null }>,
  currency?: string | null
): string | null;
