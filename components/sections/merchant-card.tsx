/* bitesite/components/sections/merchant-card.tsx */

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { CuisineTag } from "@/components/ui/cuisine-tag";
import { ShareMenu } from "@/components/sections/share-menu";
import { ViewCountInline } from "@/components/sections/view-count-inline";
import { getTodayHours } from "@/lib/hours";
import type { Merchant } from "@/types";

interface MerchantCardProps {
  merchant: Merchant;
  viewCount?: number;
}

export function MerchantCard({ merchant, viewCount = 0 }: MerchantCardProps) {
  const { isOpen, hoursText } = getTodayHours(merchant.operating_hours);

  return (
    <Link
      href={`/store/${merchant.slug}`}
      className="group block active:scale-[0.98] transition-all duration-200"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <article className="overflow-hidden rounded-xl border border-[#DDE5DC] bg-[#FAFBF7] shadow-sm transition-shadow duration-300 hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden">
          <SafeImage
            src={merchant.cover_image}
            alt={`${merchant.name} cover photo`}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          
          {/* Open Now badge - top left */}
          <div className="absolute top-3 left-3 z-10">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md ${
                isOpen
                  ? "bg-green-500/90 text-white"
                  : "bg-stone-800/80 text-stone-300"
              }`}
            >
              <Clock className="h-3 w-3" />
              {isOpen ? "Open Now" : "Closed"}
            </span>
          </div>

          {/* Share Menu - top right */}
          <div className="absolute top-3 right-3 z-20">
            <ShareMenu slug={merchant.slug} name={merchant.name} />
          </div>

          {/* View Count - bottom right */}
          {viewCount > 0 && (
            <div className="absolute bottom-3 right-3 z-10">
              <ViewCountInline count={viewCount} size="sm" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        <div className="p-5">
          {/* Tags */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {merchant.cuisine_type && (
              <CuisineTag label={merchant.cuisine_type.split(",")[0].trim()} />
            )}
            {merchant.tags?.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full border border-[#DDE5DC] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#8A968B]"
              >
                {tag}
              </span>
            ))}
          </div>
          <h3 className="mb-1 font-serif text-xl font-medium text-[#2C3E2D] leading-tight tracking-wide">
            {merchant.name}
          </h3>
          <p className="mb-3 line-clamp-2 text-sm text-[#6B6560] leading-relaxed">
            {merchant.description || "Discover this amazing restaurant."}
          </p>
          {/* Hours info */}
          <p className="mb-4 text-xs text-[#8A968B] flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Today: {hoursText}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A8F6E] transition-colors group-hover:text-[#4A7A5E]">
            View Menu
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </article>
    </Link>
  );
}
