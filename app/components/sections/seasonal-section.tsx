"use client";

import { FadeIn } from "@/app/components/animations";
import { SafeImage } from "@/app/components/safe-image";
import { Sparkles, Calendar } from "lucide-react";
import type { LayoutVariant } from "./gallery-section";

export interface SeasonalItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  price?: string;
  period?: string;
}

interface SeasonalSectionProps {
  items: SeasonalItem[];
  title?: string;
  subtitle?: string;
  variant?: LayoutVariant;
}

const sectionBg: Record<LayoutVariant, string> = {
  classic: "bg-gradient-to-b from-amber-50 to-white",
  elegant: "bg-gradient-to-b from-slate-900 to-slate-950",
  minimal: "bg-gradient-to-b from-stone-100 to-white",
  modern:  "bg-gradient-to-b from-slate-50 to-white",
  rustic:  "bg-gradient-to-b from-orange-50 to-white",
};

const cardBg: Record<LayoutVariant, string> = {
  classic: "bg-white border-amber-200",
  elegant: "bg-slate-800 border-slate-700",
  minimal: "bg-white border-stone-200",
  modern:  "bg-white border-slate-200 shadow-md",
  rustic:  "bg-white border-orange-200",
};

const textColor: Record<LayoutVariant, string> = {
  classic: "text-amber-900",
  elegant: "text-slate-100",
  minimal: "text-stone-800",
  modern:  "text-slate-800",
  rustic:  "text-orange-900",
};

const badgeBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-100 text-amber-800",
  elegant: "bg-amber-900/40 text-amber-300",
  minimal: "bg-stone-200 text-stone-700",
  modern:  "bg-slate-100 text-slate-700",
  rustic:  "bg-orange-100 text-orange-800",
};

export function SeasonalSection({
  items,
  title = "Seasonal Specials",
  subtitle = "Limited time offerings you don't want to miss",
  variant = "classic",
}: SeasonalSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <FadeIn>
      <section className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4 ${badgeBg[variant]}`}>
              <Sparkles size={14} />Limited Time
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${textColor[variant]}`}>{title}</h2>
            <p className={`opacity-60 ${textColor[variant]}`}>{subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border overflow-hidden transition-transform active:scale-[0.98] touch-manipulation ${cardBg[variant]}`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {item.image && (
                  <div className="relative aspect-[4/3]">
                    <SafeImage src={item.image} alt={item.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    {item.price && (
                      <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-bold bg-white/90 backdrop-blur-sm text-slate-900 shadow-sm">
                        {item.price}
                      </div>
                    )}
                  </div>
                )}
                <div className="p-5">
                  <h3 className={`text-lg font-bold mb-1 ${textColor[variant]}`}>{item.name}</h3>
                  {item.period && (
                    <p className={`text-sm opacity-60 mb-2 flex items-center gap-1.5 ${textColor[variant]}`}>
                      <Calendar size={12} />{item.period}
                    </p>
                  )}
                  {item.description && (
                    <p className={`text-sm opacity-70 leading-relaxed ${textColor[variant]}`}>{item.description}</p>
                  )}
                  {!item.image && item.price && (
                    <p className={`font-bold text-lg mt-3 ${textColor[variant]}`}>{item.price}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
