"use client";

import { useState } from "react";
import { FadeIn } from "@/app/components/animations";
import { SafeImage } from "@/app/components/safe-image";
import { Sparkles, Calendar, Flame, Clock } from "lucide-react";
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
  id?: string;
}

const sectionBg: Record<LayoutVariant, string> = {
  classic: "bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50",
  elegant: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950",
  minimal: "bg-gradient-to-br from-stone-100 via-stone-50 to-white",
  modern:  "bg-gradient-to-br from-slate-100 via-white to-slate-50",
  rustic:  "bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50",
};

const cardBg: Record<LayoutVariant, string> = {
  classic: "bg-white",
  elegant: "bg-slate-800",
  minimal: "bg-white",
  modern:  "bg-white",
  rustic:  "bg-white",
};

const textColor: Record<LayoutVariant, string> = {
  classic: "text-amber-900",
  elegant: "text-slate-100",
  minimal: "text-stone-800",
  modern:  "text-slate-800",
  rustic:  "text-orange-900",
};

const badgeBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-500 text-white",
  elegant: "bg-amber-500 text-slate-900",
  minimal: "bg-stone-800 text-white",
  modern:  "bg-slate-900 text-white",
  rustic:  "bg-orange-600 text-white",
};

export function SeasonalSection({
  items,
  title = "Seasonal Specials",
  subtitle = "Limited time offerings you don't want to miss",
  variant = "classic",
  id,
}: SeasonalSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <FadeIn>
      <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
        <div className="max-w-6xl mx-auto">
          {/* 头部 */}
          <div className="text-center mb-12">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4 shadow-lg ${badgeBg[variant]}`}>
              <Sparkles size={16} className="animate-pulse" />
              LIMITED TIME ONLY
            </div>
            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${textColor[variant]}`}>
              {title}
            </h2>
            <p className={`opacity-60 max-w-md mx-auto ${textColor[variant]}`}>
              {subtitle}
            </p>
          </div>

          {/* 卡片网格 */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`group relative rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] touch-manipulation ${cardBg[variant]}`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {/* 图片 */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {item.image ? (
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Flame size={32} className="text-gray-400" />
                    </div>
                  )}
                  {/* 价格浮动标签 */}
                  {item.price && (
                    <div className="absolute top-4 right-4 px-4 py-1.5 rounded-full text-sm font-bold bg-white/95 backdrop-blur-sm text-slate-900 shadow-md">
                      {item.price}
                    </div>
                  )}
                  {/* 底部渐变遮罩 */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                </div>

                {/* 内容 */}
                <div className="p-5">
                  <h3 className={`text-xl font-bold mb-2 ${textColor[variant]}`}>
                    {item.name}
                  </h3>
                  {item.period && (
                    <p className={`text-sm mb-3 flex items-center gap-1.5 opacity-70 ${textColor[variant]}`}>
                      <Clock size={14} />
                      {item.period}
                    </p>
                  )}
                  {item.description && (
                    <p className={`text-sm opacity-70 leading-relaxed ${textColor[variant]}`}>
                      {item.description}
                    </p>
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
