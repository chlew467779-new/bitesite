type HoursSpec = { "@type": "OpeningHoursSpecification"; dayOfWeek: string; opens: string; closes: string };
type SchemaProduct = {
  category_id: string | null;
  name: string;
  description?: string | null;
  price?: unknown;
  discount_price?: unknown;
  show_prices?: boolean | null;
  sort_order?: number | null;
};
type SchemaCategory = { id: string; name: string; sort_order?: number | null };

export declare function openingHoursSpecification(operatingHours: Record<string, string> | null | undefined): HoursSpec[];
export declare function menuSchema(
  categories: ReadonlyArray<SchemaCategory>,
  products: ReadonlyArray<SchemaProduct>,
  currency: string | null | undefined,
  menuUrl: string
): Record<string, unknown>;
export declare function restaurantSchema(input: {
  merchant: {
    name: string;
    cover_image?: string | null;
    description?: string | null;
    phone?: string | null;
    address?: string | null;
    area?: string | null;
    currency?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    operating_hours?: Record<string, string> | null;
  };
  url: string;
  categories: ReadonlyArray<SchemaCategory>;
  products: ReadonlyArray<SchemaProduct>;
  cuisines: ReadonlyArray<string | null | undefined>;
}): Record<string, unknown>;
export declare function storeTitle(merchant: { name: string; area?: string | null }, cuisine: string | null | undefined): string;
export declare function storeDescription(
  merchant: { name: string; area?: string | null; description?: string | null },
  cuisine: string | null | undefined,
  range: string | null | undefined
): string;
