/* bitesite/app/components/sections/tier-sections.tsx */

"use client";

import { GallerySection } from "./gallery-section";
import { ReviewsSection } from "./reviews-section";
import { AppointmentSection } from "./appointment-section";
import { SeasonalSection } from "./seasonal-section";
import { EventsSection } from "./events-section";
import { mergeFeatures, type MerchantFeatures } from "@/types";
import type { Merchant, Product } from "@/types";
import type { LayoutVariant } from "./gallery-section";

interface TierSectionsProps {
  merchant: Merchant;
  products: Product[];
  features?: Partial<MerchantFeatures>;
  variant: LayoutVariant;
}

export function TierSections({
  merchant,
  products,
  features,
  variant,
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
      price: p.discount_price
        ? `RM ${p.discount_price}`
        : p.price
        ? `RM ${p.price}`
        : undefined,
    }));

  return (
    <>
      {resolved.gallery && (
        <GallerySection images={galleryImages} variant={variant} id="gallery-section" />
      )}

      {resolved.seasonal_popup && seasonalItems.length > 0 && (
        <SeasonalSection items={seasonalItems} variant={variant} id="seasonal-section" />
      )}

      {resolved.events && (
        <EventsSection events={[]} variant={variant} id="events-section" />
      )}

      {resolved.reviews && (
        <ReviewsSection reviews={[]} variant={variant} id="reviews-section" />
      )}

      {resolved.appointment && (
        <AppointmentSection
          merchantName={merchant.name}
          phone={merchant.phone ?? undefined}
          whatsapp={merchant.whatsapp ?? undefined}
          variant={variant}
          id="reserve-section"
        />
      )}
    </>
  );
}
