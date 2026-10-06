/* bitesite/components/sections/merchant-card.tsx */

import Link from "next/link";
import { SafeImage } from "@/app/components/safe-image";
import { OpenStatusPill } from "@/components/store/open-status-pill";
import { FavouriteButton } from "@/components/store/favourite-button";
import { getTodayKey } from "@/lib/hours";
import { formatDistanceKm } from "@/lib/nearby-core.mjs";
import type { PublicMerchant } from "@/types";

interface MerchantCardProps {
  merchant: PublicMerchant;
  distanceKm?: number;
  /** "RM 5–15" from lib/store-summary.mjs priceRange; omitted when unknown. */
  priceText?: string | null;
}

/** Restaurant card (R3 design): big photo with open status, name, cuisine · area, distance, price. */
export function MerchantCard({ merchant, distanceKm, priceText }: MerchantCardProps) {
  const todayHours = merchant.operating_hours?.[getTodayKey()];
  const cuisine = merchant.cuisine_type?.split(",")[0].trim();
  const meta = [cuisine, merchant.area].filter(Boolean).join(" · ");

  return (
    <div className="relative">
      <Link
        href={`/store/${merchant.slug}`}
        className="group flex flex-col gap-2.5 text-ink [-webkit-tap-highlight-color:transparent]"
      >
        <div className="relative h-[196px] overflow-hidden rounded-[20px] bg-surface sm:h-auto sm:aspect-[4/3]">
          {merchant.cover_image ? (
            <SafeImage
              src={merchant.cover_image}
              alt={`${merchant.name} cover photo`}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <span aria-hidden className="flex h-full items-center justify-center bg-brand-soft text-6xl font-extrabold text-brand opacity-40">
              {merchant.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="absolute bottom-3 left-3">
            <OpenStatusPill todayHours={todayHours} onPhoto />
          </div>
        </div>
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-[17px] font-bold leading-snug group-hover:text-brand">{merchant.name}</h3>
            {meta && <p className="mt-0.5 text-sm text-muted">{meta}</p>}
          </div>
          {(distanceKm !== undefined || priceText) && (
            <div className="shrink-0 text-right">
              {distanceKm !== undefined && <p className="text-sm font-bold">{formatDistanceKm(distanceKm)}</p>}
              {priceText && <p className="mt-0.5 text-[13px] text-muted">{priceText}</p>}
            </div>
          )}
        </div>
      </Link>
      {/* Outside the link: a button may not sit inside an <a>. */}
      <FavouriteButton slug={merchant.slug} name={merchant.name} className="absolute right-3 top-3" />
    </div>
  );
}
