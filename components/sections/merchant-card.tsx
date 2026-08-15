import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { CuisineTag } from "@/components/ui/cuisine-tag";
import type { Merchant } from "@/types";

interface MerchantCardProps {
  merchant: Merchant;
}

export function MerchantCard({ merchant }: MerchantCardProps) {
  return (
    <a href={`/store/${merchant.slug}`} className="group block active:scale-[0.98] transition-transform duration-150" style={{ WebkitTapHighlightColor: "transparent" }}>
      <article className="overflow-hidden rounded-xl border border-[#DDE5DC] bg-[#FAFBF7] shadow-sm transition-shadow duration-500 group-hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden">
          <SafeImage
            src={merchant.cover_image}
            alt={`${merchant.name} cover photo`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
        <div className="p-5">
          <div className="mb-2 flex items-center gap-2">
            {merchant.cuisine_type && <CuisineTag label={merchant.cuisine_type.split(",")[0].trim()} />}
          </div>
          <h3 className="mb-1 font-serif text-xl font-medium text-[#2C3E2D] leading-tight">
            {merchant.name}
          </h3>
          <p className="mb-4 line-clamp-2 text-sm text-[#6B6560] leading-relaxed">
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
