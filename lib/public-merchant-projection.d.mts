/* bitesite/lib/public-merchant-projection.d.mts */

/** Merchant columns readable by the public database roles (see public-merchant-projection.mjs). */
export declare const PUBLIC_MERCHANT_COLUMNS: readonly [
  "id",
  "slug",
  "name",
  "tagline",
  "description",
  "cuisine_type",
  "cuisine",
  "amenities",
  "occasion",
  "tags",
  "area",
  "address",
  "latitude",
  "longitude",
  "phone",
  "whatsapp",
  "email",
  "website",
  "instagram",
  "facebook",
  "cover_image",
  "logo_image",
  "operating_hours",
  "dress_code",
  "menu_pdf_url",
  "video_url",
  "video_type",
  "video_caption",
  "payment_methods",
  "layout",
  "features",
  "status",
  "business_status",
  "created_at",
  "updated_at",
];

/** PUBLIC_MERCHANT_COLUMNS joined for a PostgREST select. */
export declare const PUBLIC_MERCHANT_SELECT: string;
