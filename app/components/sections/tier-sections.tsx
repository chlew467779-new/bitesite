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
    ...products.map((p) => p.image_url).filter(Boolean),
  ].filter((url, i, arr) => arr.indexOf(url) === i);

  const seasonalItems = products
    .filter((p) => p.is_featured)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      image: p.image_url,
      price: p.discount_price
        ? `RM ${p.discount_price}`
        : p.price
        ? `RM ${p.price}`
        : undefined,
    }));

  return (
    <>
      {resolved.gallery && (
        <GallerySection images={galleryImages} variant={variant} />
      )}

      {resolved.seasonal_popup && seasonalItems.length > 0 && (
        <SeasonalSection items={seasonalItems} variant={variant} />
      )}

      {resolved.events && (
        <EventsSection events={[]} variant={variant} />
      )}

      {resolved.reviews && (
        <ReviewsSection reviews={[]} variant={variant} />
      )}

      {resolved.appointment && (
        <AppointmentSection
          merchantName={merchant.name}
          phone={merchant.phone}
          whatsapp={merchant.whatsapp}
          variant={variant}
        />
      )}
    </>
  );
}
