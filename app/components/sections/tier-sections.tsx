/* bitesite/app/components/sections/tier-sections.tsx */

"use client";

import { GallerySection } from "./gallery-section";
import { AppointmentSection } from "./appointment-section";
import { SeasonalSection } from "./seasonal-section";
import { EventsSection } from "./events-section";
import { mergeFeatures, type MerchantFeatures } from "@/types";
import type { Merchant, Product, EventItem } from "@/types";
import { shouldShowPrice } from "@/lib/menu-display.mjs";
import { normalizeBookingWhatsApp } from "@/lib/merchant-booking-target.mjs";
import type { LayoutVariant } from "./gallery-section";

interface TierSectionsProps {
  merchant: Merchant;
  products: Product[];
  features?: Partial<MerchantFeatures>;
  variant: LayoutVariant;
  events?: EventItem[];
}

export function TierSections({
  merchant,
  products,
  features,
  variant,
  events,
}: TierSectionsProps) {
  const resolved = mergeFeatures(features);

  const galleryImages = [
    merchant.cover_image,
    ...products.map((p) => p.image_url),
  ]
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .filter((url, i, arr) => arr.indexOf(url) === i);

  const seasonalItems = products
    .filter((p) => p.is_featured)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      image: p.image_url ?? undefined,
      // A dish with prices hidden must not leak its price here either. SeasonalSection skips the
      // price element entirely when this is undefined, so nothing empty is left behind.
      price: !shouldShowPrice(p)
        ? undefined
        : p.discount_price
        ? `RM ${p.discount_price}`
        : p.price
        ? `RM ${p.price}`
        : undefined,
    }));

  const hasGallery = galleryImages.length > 0;
  const hasEvents = (events?.length ?? 0) > 0;
  // Booking only goes to the restaurant's own valid WhatsApp number; there is no fallback.
  const canBook = resolved.appointment && normalizeBookingWhatsApp(merchant.whatsapp) !== null;

  return (
    <>
      {resolved.gallery && hasGallery && (
        <GallerySection images={galleryImages} variant={variant} id="gallery-section" />
      )}

      {resolved.seasonal_popup && seasonalItems.length > 0 && (
        <SeasonalSection items={seasonalItems} variant={variant} id="seasonal-section" />
      )}

      {resolved.events && hasEvents && (
        <EventsSection events={events || []} variant={variant} id="events-section" />
      )}

      {/* The legacy review carousel is intentionally not rendered: those entries were
          never verified customer reviews. An Admin-reviewed Google reviews link replaces it later. */}

      {canBook && (
        <AppointmentSection
          merchantName={merchant.name}
          whatsapp={merchant.whatsapp}
          variant={variant}
          id="reserve-section"
          slug={merchant.slug}
        />
      )}
    </>
  );
}
