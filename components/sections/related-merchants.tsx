/* bitesite/components/sections/related-merchants.tsx */

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { getTodayHours } from "@/lib/hours";
import type { Merchant } from "@/types";
import type { LayoutKey } from "@/lib/layout-registry.mjs";
import { getLayoutTheme } from "@/lib/layout-theme.mjs";

type LayoutVariant = LayoutKey;

interface RelatedMerchantsProps {
  merchants: Merchant[];
  variant?: LayoutVariant;
}

export function RelatedMerchants({ merchants, variant = "classic" }: RelatedMerchantsProps) {
  if (merchants.length === 0) return null;
  const s = getLayoutTheme(variant).related;

  return (
    <section className={`py-16 px-4 border-t ${s.section}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className={`font-serif text-2xl font-medium ${s.title}`}>
            You May Also Like
          </h2>
          <Link
            href="/"
            className={`inline-flex items-center gap-1 text-sm font-medium ${s.viewAll} ${s.viewAllHover} transition-colors`}
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
                <article className={`overflow-hidden rounded-xl border ${s.cardBorder} ${s.cardBg} shadow-sm transition-shadow duration-300 hover:shadow-md`}>
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
                            : s.closedBadge
                        }`}
                      >
                        {isOpen ? "Open Now" : "Closed"}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    {merchant.cuisine_type && (
                      <span className={`inline-block rounded-full border ${s.cuisineTagBorder} ${s.cuisineTagBg} px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${s.cuisineTagText} mb-2`}>
                        {merchant.cuisine_type.split(",")[0].trim()}
                      </span>
                    )}
                    {merchant.area && (
                      <span className={`inline-block rounded-full ${s.areaTagBg} px-2 py-0.5 text-[10px] font-medium ${s.areaTagText} mb-2 ml-1`}>
                        {merchant.area}
                      </span>
                    )}
                    <h3 className={`font-serif text-lg font-medium leading-tight tracking-wide mb-1 ${s.title}`}>
                      {merchant.name}
                    </h3>
                    <p className={`text-xs mb-3 ${s.hoursText}`}>
                      Today: {hoursText}
                    </p>
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.viewMenu} ${s.viewMenuHover} transition-colors`}>
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
