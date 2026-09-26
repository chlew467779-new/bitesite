/**
 * The merchant columns the public (anon / authenticated) database role may read.
 *
 * Kept as a small ESM module (same convention as lib/menu-display.mjs) so
 * scripts/test-merchant-public-projection.mjs can compare it with the migration that grants the
 * columns. public-merchant-projection.d.mts carries the types.
 *
 * Since D1b the database grants SELECT on exactly these columns
 * (supabase/migrations/20260926101050_merchant_public_projection.sql). Anything else, such as
 * legacy reviews, settings, style internals and the review / visibility / audit state, is
 * readable only by server code using the service role. A public read that asks for another
 * column, uses select("*"), or filters on is_published fails with "permission denied".
 *
 * Which merchants are visible is decided by row level security (private.merchant_is_public),
 * not by a filter in the query.
 *
 * To make a new column public: add it here, to the grant in a new migration, and to
 * supabase/tests/d1b_projection_assertions.sql.
 */

export const PUBLIC_MERCHANT_COLUMNS = Object.freeze([
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
]);

/** The PostgREST select string for a full public merchant row. */
export const PUBLIC_MERCHANT_SELECT = PUBLIC_MERCHANT_COLUMNS.join(",");
