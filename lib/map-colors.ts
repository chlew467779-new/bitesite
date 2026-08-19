/* bitesite/lib/map-colors.ts */

export const CUISINE_COLORS: Record<string, string> = {
  Cafe: "#8B4513",
  Western: "#F59E0B",
  Bakery: "#F97316",
  Japanese: "#EF4444",
  Asian: "#EF4444",
  Dessert: "#EC4899",
};

export function getMarkerColor(cuisineType: string | null | undefined): string {
  if (!cuisineType) return "#6B7280";
  const type = cuisineType.split(",")[0].trim();
  return CUISINE_COLORS[type] || "#6B7280";
}
