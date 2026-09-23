/* bitesite/app/dev/layout-fixtures/fixtures.ts */

import type { Category, Merchant, Product } from "@/types";

/**
 * In-memory data for the development-only layout fixtures page.
 *
 * Everything here is invented: no database, no network, no real merchant. Kept in its own module
 * so the shapes can be typechecked against the real Merchant/Category/Product types (and so the
 * page itself stays a thin wrapper around the production guard and the layout renderer).
 */

export const PRICE_STATES = ["normal", "discount", "hidden"] as const;
export const DISH_STATES = ["default", "soldout-hidden", "featured-hidden"] as const;
export const IMAGE_STATES = ["with", "without"] as const;

export type PriceState = (typeof PRICE_STATES)[number];
export type DishState = (typeof DISH_STATES)[number];
export type ImageState = (typeof IMAGE_STATES)[number];

export function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Inline placeholder so no external host is involved and no file ships in /public. */
export const FIXTURE_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">` +
    `<rect width="640" height="480" fill="#d8d2c6"/>` +
    `<circle cx="320" cy="212" r="120" fill="#b9ae9b"/>` +
    `<rect x="160" y="360" width="320" height="28" rx="14" fill="#a89d8a"/>` +
    `</svg>`,
)}`;

export const FIXTURE_CATEGORIES: Category[] = [
  { id: "cat-mains", merchant_id: "fixture-merchant", name: "Mains", sort_order: 1, created_at: "2026-01-01T00:00:00Z" },
  { id: "cat-drinks", merchant_id: "fixture-merchant", name: "Drinks", sort_order: 2, created_at: "2026-01-01T00:00:00Z" },
];

export function buildProducts(price: PriceState, dish: DishState, image: ImageState): Product[] {
  const imageUrl = image === "with" ? FIXTURE_IMAGE : null;
  const base = {
    merchant_id: "fixture-merchant",
    image_url: imageUrl,
    created_at: "2026-01-01T00:00:00Z",
    is_available: true,
    is_featured: false,
    discount_price: null as number | null,
    show_prices: price !== "hidden",
  };

  return [
    {
      ...base,
      id: "dish-1",
      category_id: "cat-mains",
      name: "Nasi Lemak Ayam Berempah",
      description: "Coconut rice, spiced fried chicken, sambal, egg, peanuts.",
      price: 12.9,
      discount_price: price === "discount" ? 9.9 : null,
      sort_order: 1,
    },
    {
      ...base,
      id: "dish-2",
      category_id: "cat-mains",
      name: "Sold out dish — long name to test wrapping 招牌炒粿条 Char Kuey Teow",
      description: null,
      price: 15,
      discount_price: price === "discount" ? 11.5 : null,
      is_available: false,
      // This variant exists to check that "sold out" still reads clearly with no price beside it.
      show_prices: dish === "soldout-hidden" ? false : base.show_prices,
      sort_order: 2,
    },
    {
      ...base,
      id: "dish-3",
      category_id: "cat-drinks",
      name: "Teh Tarik",
      description: "Pulled milk tea.",
      price: 3.5,
      discount_price: price === "discount" ? 2.9 : null,
      is_featured: true,
      // Featured dishes also appear in the Seasonal section, which builds its own price string.
      show_prices: dish === "featured-hidden" ? false : base.show_prices,
      sort_order: 1,
    },
    {
      ...base,
      id: "dish-4",
      category_id: null,
      name: "Uncategorized dish (should never appear below)",
      description: "Present in the data, deliberately not rendered by any public layout.",
      price: 8,
      sort_order: 3,
    },
  ];
}

export function buildMerchant(layoutKey: string, image: ImageState): Merchant {
  return {
    id: "fixture-merchant",
    slug: "__dev-fixture__",
    name: "Fixture Kopitiam",
    description: "A fictional shop used to review layouts. No real merchant data is involved.",
    cuisine_type: "Malaysian",
    address: "1 Fixture Street, Kuala Lumpur",
    phone: "+60 3-0000 0000",
    whatsapp: "+60 12-000 0000",
    email: "fixture@example.com",
    website: "https://example.com",
    instagram: "https://example.com",
    facebook: null,
    cover_image: image === "with" ? FIXTURE_IMAGE : null,
    logo_image: null,
    operating_hours: {
      monday: "09:00-18:00",
      tuesday: "09:00-18:00",
      wednesday: "09:00-18:00",
      thursday: "09:00-18:00",
      friday: "09:00-21:00",
      saturday: "10:00-21:00",
      sunday: "",
    },
    dress_code: null,
    menu_pdf_url: null,
    video_url: null,
    video_type: null,
    video_caption: null,
    reference_website: null,
    custom_style: null,
    style: "fresh",
    is_published: false,
    created_at: "2026-01-01T00:00:00Z",
    layout: layoutKey,
    features: {
      hero: true,
      about: true,
      menu: true,
      contact: true,
      gallery: true,
      reviews: false,
      appointment: false,
      seasonal_popup: true,
      events: false,
    },
    settings: {},
    status: "active",
    platform_status: "DRAFT",
    business_status: "OPEN",
    area: "Kuala Lumpur",
    cuisine: [],
    amenities: [],
    occasion: [],
    tags: [],
    payment_methods: ["Cash", "Cashless"],
    latitude: null,
    longitude: null,
    reviews: null,
  };
}
