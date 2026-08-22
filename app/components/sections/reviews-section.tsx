/* bitesite/app/components/sections/reviews-section.tsx */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FadeIn } from "@/app/components/animations";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import type { LayoutVariant } from "./gallery-section";
import type { Review } from "@/types";

interface ReviewsSectionProps {
  reviews: Review[];
  title?: string;
  variant?: LayoutVariant;
  id?: string;
}

const sectionBg: Record<LayoutVariant, string> = {
  classic: "bg-white",
  elegant: "bg-slate-900",
  minimal: "bg-stone-100",
  modern:  "bg-slate-50",
  rustic:  "bg-amber-50",
};

const cardBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-50/80 border-amber-200",
  elegant: "bg-slate-800 border-slate-700",
  minimal: "bg-white border-stone-200",
  modern:  "bg-white border-slate-200 shadow-sm",
  rustic:  "bg-white border-orange-200",
};

const textColor: Record<LayoutVariant, string> = {
  classic: "text-amber-900",
  elegant: "text-slate-200",
  minimal: "text-stone-700",
  modern:  "text-slate-700",
  rustic:  "text-orange-900",
};

const dotActive: Record<LayoutVariant, string> = {
  classic: "bg-amber-700",
  elegant: "bg-amber-400",
  minimal: "bg-stone-800",
  modern:  "bg-slate-900",
  rustic:  "bg-orange-700",
};

const dotInactive: Record<LayoutVariant, string> = {
  classic: "bg-amber-200",
  elegant: "bg-slate-700",
  minimal: "bg-stone-200",
  modern:  "bg-slate-200",
  rustic:  "bg-orange-200",
};

const arrowBg: Record<LayoutVariant, string> = {
  classic: "bg-white border-amber-200 text-amber-900 hover:bg-amber-50",
  elegant: "bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700",
  minimal: "bg-white border-stone-200 text-stone-800 hover:bg-stone-50",
  modern:  "bg-white border-slate-200 text-slate-800 hover:bg-slate-50",
  rustic:  "bg-white border-orange-200 text-orange-900 hover:bg-orange-50",
};

export function ReviewsSection({
  reviews,
  title = "What Our Guests Say",
  variant = "classic",
  id,
}: ReviewsSectionProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const displayReviews = reviews.slice(0, 5);
  const maxReviews = displayReviews.length;

  const goNext = useCallback(() => {
    setCurrent((prev) => (prev + 1) % maxReviews);
  }, [maxReviews]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + maxReviews) % maxReviews);
  }, [maxReviews]);

  useEffect(() => {
    if (maxReviews <= 1 || isPaused) return;
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [maxReviews, isPaused, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  if (!reviews || reviews.length === 0) return null;

  const review = displayReviews[current];

  return (
    <FadeIn>
      <section
        id={id}
        className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="max-w-3xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-10 ${textColor[variant]}`}>
            {title}
          </h2>

          <div
            className="relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className={`p-6 sm:p-10 rounded-2xl border ${cardBg[variant]} text-center transition-all duration-500`}>
              <Quote size={32} className={`mx-auto mb-4 opacity-20 ${textColor[variant]}`} strokeWidth={2.5} />

              <div className="flex justify-center gap-1 mb-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className={i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300 fill-gray-300"}
                  />
                ))}
              </div>

              <p className={`text-lg sm:text-xl leading-relaxed mb-6 ${textColor[variant]}`}>
                &ldquo;{review.text}&rdquo;
              </p>

              <div>
                <p className={`font-semibold text-sm ${textColor[variant]}`}>{review.author}</p>
                <p className={`text-xs opacity-50 ${textColor[variant]}`}>{review.date}</p>
              </div>
            </div>

            {maxReviews > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className={`hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-6 h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-90 ${arrowBg[variant]}`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  aria-label="Previous review"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={goNext}
                  className={`hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-6 h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-90 ${arrowBg[variant]}`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  aria-label="Next review"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {maxReviews > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {displayReviews.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current ? `${dotActive[variant]} w-6` : `${dotInactive[variant]} w-2`
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  aria-label={`Go to review ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </FadeIn>
  );
}
