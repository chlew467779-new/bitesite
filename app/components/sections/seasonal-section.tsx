/* bitesite/app/components/sections/seasonal-section.tsx */

"use client";

import { useState } from "react";
import { FadeIn } from "@/app/components/animations";
import { SafeImage } from "@/app/components/safe-image";
import { Sparkles, Calendar, Flame, Clock } from "lucide-react";
import type { LayoutVariant } from "./gallery-section";
import { getLayoutTheme } from "@/lib/layout-theme.mjs";

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

export function SeasonalSection({
  items,
  title = "Seasonal Specials",
  subtitle = "Limited time offerings you don't want to miss",
  variant = "classic",
  id,
}: SeasonalSectionProps) {
  const theme = getLayoutTheme(variant).seasonal;
  if (!items || items.length === 0) return null;

  return (
    <FadeIn>
      <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${theme.sectionBg}`}>
        <div className="max-w-6xl mx-auto">
          {/* 头部 */}
          <div className="text-center mb-12">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4 shadow-lg ${theme.badge}`}>
              <Sparkles size={16} className="animate-pulse" />
              LIMITED TIME ONLY
            </div>
            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${theme.text}`}>
              {title}
            </h2>
            <p className={`opacity-60 max-w-md mx-auto ${theme.text}`}>
              {subtitle}
            </p>
          </div>

          {/* 卡片网格 */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`group relative rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] touch-manipulation ${theme.card}`}
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
                  <h3 className={`text-xl font-bold mb-2 ${theme.text}`}>
                    {item.name}
                  </h3>
                  {item.period && (
                    <p className={`text-sm mb-3 flex items-center gap-1.5 opacity-70 ${theme.text}`}>
                      <Clock size={14} />
                      {item.period}
                    </p>
                  )}
                  {item.description && (
                    <p className={`text-sm opacity-70 leading-relaxed ${theme.text}`}>
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
