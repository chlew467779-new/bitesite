"use client";

import { FadeIn } from "@/app/components/animations";
import { Star, Quote, MessageCircle } from "lucide-react";
import type { LayoutVariant } from "./gallery-section";

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  avatar?: string;
}

interface ReviewsSectionProps {
  reviews: Review[];
  title?: string;
  variant?: LayoutVariant;
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

const avatarBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-200 text-amber-800",
  elegant: "bg-slate-700 text-slate-300",
  minimal: "bg-stone-200 text-stone-600",
  modern:  "bg-slate-200 text-slate-600",
  rustic:  "bg-orange-200 text-orange-800",
};

export function ReviewsSection({
  reviews,
  title = "What Our Guests Say",
  variant = "classic",
}: ReviewsSectionProps) {
  if (!reviews || reviews.length === 0) {
    return (
      <FadeIn>
        <section className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className={`text-2xl font-bold mb-3 ${textColor[variant]}`}>{title}</h2>
            <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl ${cardBg[variant]}`}>
              <MessageCircle size={18} className={`opacity-50 ${textColor[variant]}`} />
              <span className={`text-sm opacity-60 ${textColor[variant]}`}>
                No reviews yet. Be the first to share your experience!
              </span>
            </div>
          </div>
        </section>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <section className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-10 ${textColor[variant]}`}>
            {title}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div
                key={review.id}
                className={`p-6 rounded-2xl border ${cardBg[variant]} transition-transform active:scale-[0.98] touch-manipulation`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Quote size={24} className={`mb-3 opacity-20 ${textColor[variant]}`} strokeWidth={2.5} />
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300 fill-gray-300"}
                    />
                  ))}
                </div>
                <p className={`mb-5 leading-relaxed text-[15px] ${textColor[variant]}`}>
                  "{review.text}"
                </p>
                <div className="flex items-center gap-3">
                  {review.avatar ? (
                    <img src={review.avatar} alt={review.author} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${avatarBg[variant]}`}>
                      {review.author.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className={`font-semibold text-sm ${textColor[variant]}`}>{review.author}</p>
                    <p className={`text-xs opacity-50 ${textColor[variant]}`}>{review.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
