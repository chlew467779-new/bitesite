/* bitesite/components/sections/related-merchants.tsx */

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { getTodayHours } from "@/lib/hours";
import type { Merchant } from "@/types";

type LayoutVariant = "classic" | "elegant" | "minimal" | "modern" | "rustic";

interface RelatedMerchantsProps {
  merchants: Merchant[];
  variant?: LayoutVariant;
}

const styles: Record<LayoutVariant, {
  section: string;
  title: string;
  viewAll: string;
  viewAllHover: string;
  cardBg: string;
  cardBorder: string;
  cuisineTagBorder: string;
  cuisineTagBg: string;
  cuisineTagText: string;
  areaTagBg: string;
  areaTagText: string;
  hoursText: string;
  viewMenu: string;
  viewMenuHover: string;
  closedBadge: string;
}> = {
  classic: {
    section: "bg-amber-50/60 border-amber-200",
    title: "text-amber-900",
    viewAll: "text-amber-700",
    viewAllHover: "hover:text-amber-900",
    cardBg: "bg-white",
    cardBorder: "border-amber-100",
    cuisineTagBorder: "border-amber-200",
    cuisineTagBg: "bg-white",
    cuisineTagText: "text-amber-800/70",
    areaTagBg: "bg-[#5A8F6E]/10",
    areaTagText: "text-[#5A8F6E]",
    hoursText: "text-[#8A968B]",
    viewMenu: "text-[#5A8F6E]",
    viewMenuHover: "group-hover:text-[#4A7A5E]",
    closedBadge: "bg-stone-800/80 text-stone-300",
  },
  elegant: {
    section: "bg-slate-950 border-slate-800",
    title: "text-slate-100",
    viewAll: "text-amber-400",
    viewAllHover: "hover:text-amber-300",
    cardBg: "bg-slate-900",
    cardBorder: "border-slate-800",
    cuisineTagBorder: "border-slate-700",
    cuisineTagBg: "bg-slate-800",
    cuisineTagText: "text-slate-400",
    areaTagBg: "bg-amber-500/20",
    areaTagText: "text-amber-400",
    hoursText: "text-slate-500",
    viewMenu: "text-amber-400",
    viewMenuHover: "group-hover:text-amber-300",
    closedBadge: "bg-slate-700 text-slate-300",
  },
  minimal: {
    section: "bg-stone-100 border-stone-200",
    title: "text-stone-800",
    viewAll: "text-stone-600",
    viewAllHover: "hover:text-stone-900",
    cardBg: "bg-white",
    cardBorder: "border-stone-200",
    cuisineTagBorder: "border-stone-200",
    cuisineTagBg: "bg-white",
    cuisineTagText: "text-stone-500",
    areaTagBg: "bg-stone-200",
    areaTagText: "text-stone-700",
    hoursText: "text-stone-400",
    viewMenu: "text-stone-700",
    viewMenuHover: "group-hover:text-stone-900",
    closedBadge: "bg-stone-700 text-stone-300",
  },
  modern: {
    section: "bg-slate-50 border-slate-200",
    title: "text-slate-900",
    viewAll: "text-slate-700",
    viewAllHover: "hover:text-slate-900",
    cardBg: "bg-white",
    cardBorder: "border-slate-200",
    cuisineTagBorder: "border-slate-200",
    cuisineTagBg: "bg-white",
    cuisineTagText: "text-slate-500",
    areaTagBg: "bg-slate-200",
    areaTagText: "text-slate-700",
    hoursText: "text-slate-400",
    viewMenu: "text-slate-700",
    viewMenuHover: "group-hover:text-slate-900",
    closedBadge: "bg-slate-700 text-slate-300",
  },
  rustic: {
    section: "bg-orange-50/60 border-orange-200",
    title: "text-orange-900",
    viewAll: "text-orange-700",
    viewAllHover: "hover:text-orange-900",
    cardBg: "bg-white",
    cardBorder: "border-orange-100",
    cuisineTagBorder: "border-orange-200",
    cuisineTagBg: "bg-white",
    cuisineTagText: "text-orange-600",
    areaTagBg: "bg-orange-200",
    areaTagText: "text-orange-800",
    hoursText: "text-orange-700/60",
    viewMenu: "text-orange-700",
    viewMenuHover: "group-hover:text-orange-800",
    closedBadge: "bg-stone-800/80 text-stone-300",
  },
};

export function RelatedMerchants({ merchants, variant = "classic" }: RelatedMerchantsProps) {
  if (merchants.length === 0) return null;
  const s = styles[variant] || styles.classic;

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
