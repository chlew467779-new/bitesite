/* bitesite/lib/presets.ts */

export const CUISINE_TYPES = [
  "Cafe",
  "Western",
  "Asian",
  "Bakery",
  "Japanese",
  "Indian",
  "Chinese",
  "Korean",
  "Mexican",
  "Italian",
  "French",
  "Fusion",
  "Dessert",
  "Bar",
  "Fine Dining",
] as const;

export const CUISINE_TAGS = [
  "Chinese",
  "Malay",
  "Indian",
  "Japanese",
  "Korean",
  "Western",
  "Italian",
  "Mexican",
  "French",
  "Fusion",
  "Asian",
  "Middle Eastern",
] as const;

export const AMENITY_TAGS = [
  "Halal",
  "Pork-Free",
  "Alcohol-Free",
  "Pet Friendly",
  "WiFi",
  "Outdoor Seating",
  "Delivery",
  "Takeaway",
  "Parking",
  "Wheelchair Accessible",
  "Live Music",
  "Private Room",
  "Vegan Options",
  "Gluten Free",
] as const;

/**
 * Self-declared "Halal" and "Pork-Free" are retired (CH 2026-10-07, following ChatGPT G28): in
 * Malaysia a halal claim needs a JAKIM / state certificate, so BiteSite shows halal only through
 * the Admin-verified "Halal-certified" label. They stay in AMENITY_TAGS so rows that already hold
 * them still validate (and the Owner can remove them), but they are never offered or shown publicly.
 */
export const RETIRED_AMENITY_TAGS: readonly string[] = ["Halal", "Pork-Free"];
export const SELECTABLE_AMENITY_TAGS: readonly string[] = AMENITY_TAGS.filter((tag) => !RETIRED_AMENITY_TAGS.includes(tag));

export const OCCASION_TAGS = [
  "Cafe",
  "Bakery",
  "Dessert",
  "Bar",
  "Fine Dining",
  "Family Friendly",
  "Date Night",
  "Business Lunch",
  "Group Dining",
  "Brunch",
  "Late Night",
  "Solo Friendly",
  "Special Occasion",
] as const;

export const PAYMENT_METHODS = [
  "Cash",
  "Cashless",
  "Cards",
] as const;
