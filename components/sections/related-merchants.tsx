/* bitesite/components/sections/related-merchants.tsx */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { getTodayHours } from "@/lib/hours";
import type { Merchant } from "@/types";

interface RelatedMerchantsProps {
  merchants: Merchant[];
}

export function RelatedMerchants({ merchants }: RelatedMerchantsProps) {
  if (merchants.length === 0) return null;

  return (
    <section className="py-16 px-4 bg-[#F0F4EC] border-t border-[#DDE5DC]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-serif text-2xl font-medium text-[#2C3E2D]">
            You May Also Like
          </h2>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#5A8F6E] hover:text-[#4A7A5E] transition-colors"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {merchants.map((merchant) => {
            const { isOpen, hoursText } = getTodayHours(merchant.operating_hours);
            return (
              <Link
                key={merchant.id}
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
                    <div className="absolute top-3 left-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md ${
                          isOpen
                            ? "bg-green-500/90 text-white"
                            : "bg-stone-800/80 text-stone-300"
                        }`}
                      >
                        {isOpen ? "Open Now" : "Closed"}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    {merchant.cuisine_type && (
                      <span className="inline-block rounded-full border border-[#DDE5DC] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#8A968B] mb-2">
                        {merchant.cuisine_type.split(",")[0].trim()}
                      </span>
                    )}
                    {merchant.area && (
                      <span className="inline-block rounded-full bg-[#5A8F6E]/10 px-2 py-0.5 text-[10px] font-medium text-[#5A8F6E] mb-2 ml-1">
                        {merchant.area}
                      </span>
                    )}
                    <h3 className="font-serif text-lg font-medium text-[#2C3E2D] leading-tight tracking-wide mb-1">
                      {merchant.name}
                    </h3>
                    <p className="text-xs text-[#8A968B] mb-3">
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
          })}
        </div>
      </div>
    </section>
  );
}
