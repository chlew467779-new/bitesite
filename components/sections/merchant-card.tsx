import { ArrowRight } from "lucide-react";
import { CuisineTag } from "@/components/ui/cuisine-tag";
import type { Merchant } from "@/types";

interface MerchantCardProps {
  merchant: Merchant;
}

export function MerchantCard({ merchant }: MerchantCardProps) {
  return (
    <a href={`/store/${merchant.slug}`} className="group block">
      <article className="overflow-hidden rounded-xl border border-[#DDE5DC] bg-[#FAFBF7] shadow-sm transition-all duration-700 hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden">
          {merchant.cover_image ? (
            <img
              src={merchant.cover_image}
              alt={`${merchant.name} cover photo`}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#F0F4EC]">
              <span className="text-sm text-[#8A968B]">No image</span>
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="mb-2 flex items-center gap-2">
            {merchant.cuisine_type && <CuisineTag label={merchant.cuisine_type.split(",")[0].trim()} />}
          </div>
          <h3 className="mb-1 font-serif text-xl font-medium text-[#2C3E2D]">
            {merchant.name}
          </h3>
          <p className="mb-4 line-clamp-2 text-sm text-[#6B6560]">
            {merchant.description || "Discover this amazing restaurant."}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A8F6E] transition-colors group-hover:text-[#4A7A5E]">
            View Menu
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </article>
    </a>
  );
}
