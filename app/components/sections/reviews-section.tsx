/* bitesite/app/components/sections/reviews-section.tsx */

"use client";

import { useState } from "react";
import { FadeIn } from "@/app/components/animations";
import { Star, Quote, MessageCircle, Send, CheckCircle2, User } from "lucide-react";
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

const inputBase = "w-full px-4 py-3 rounded-xl border outline-none transition-all text-base";
const inputStyles: Record<LayoutVariant, string> = {
  classic: `${inputBase} bg-white border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20`,
  elegant: `${inputBase} bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20`,
  minimal: `${inputBase} bg-white border-stone-200 focus:border-stone-400 focus:ring-2 focus:ring-stone-400/20`,
  modern:  `${inputBase} bg-white border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20`,
  rustic:  `${inputBase} bg-white border-orange-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20`,
};

const btnPrimary: Record<LayoutVariant, string> = {
  classic: "bg-amber-700 hover:bg-amber-800",
  elegant: "bg-amber-600 hover:bg-amber-700",
  minimal: "bg-stone-800 hover:bg-stone-900",
  modern:  "bg-slate-900 hover:bg-slate-800",
  rustic:  "bg-orange-700 hover:bg-orange-800",
};

export function ReviewsSection({
  reviews,
  title = "What Our Guests Say",
  variant = "classic",
  id,
}: ReviewsSectionProps) {
  const [formData, setFormData] = useState({ author: "", text: "", rating: 5 });
  const [submitted, setSubmitted] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <FadeIn>
      <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-10 ${textColor[variant]}`}>
            {title}
          </h2>

          {/* 已有评价 */}
          {reviews && reviews.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {reviews.map((review) => (
                <div key={review.id} className={`p-6 rounded-2xl border ${cardBg[variant]} transition-transform active:scale-[0.98]`} style={{ WebkitTapHighlightColor: "transparent" }}>
                  <Quote size={24} className={`mb-3 opacity-20 ${textColor[variant]}`} strokeWidth={2.5} />
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} className={i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300 fill-gray-300"} />
                    ))}
                  </div>
                  <p className={`mb-5 leading-relaxed text-[15px] ${textColor[variant]}`}>"{review.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-600`}>
                      {review.author.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${textColor[variant]}`}>{review.author}</p>
                      <p className={`text-xs opacity-50 ${textColor[variant]}`}>{review.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 提交表单 */}
          <div className={`max-w-lg mx-auto p-6 sm:p-8 rounded-2xl border ${cardBg[variant]}`}>
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle2 size={48} className={`mx-auto mb-4 ${variant === "elegant" ? "text-amber-400" : "text-green-500"}`} />
                <h3 className={`text-xl font-bold mb-2 ${textColor[variant]}`}>Thank You!</h3>
                <p className={`opacity-70 ${textColor[variant]}`}>Your review has been submitted and is pending approval.</p>
              </div>
            ) : (
              <>
                <h3 className={`text-lg font-bold mb-6 text-center ${textColor[variant]}`}>Write a Review</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                      <User size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className={inputStyles[variant]}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>Rating</label>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setFormData({ ...formData, rating: i + 1 })}
                          onMouseEnter={() => setHoverRating(i + 1)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 transition-transform active:scale-90"
                        >
                          <Star
                            size={28}
                            className={(hoverRating ? i < hoverRating : i < formData.rating)
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-300"
                            }
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                      <MessageCircle size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Your Review
                    </label>
                    <textarea
                      required
                      value={formData.text}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      className={`${inputStyles[variant]} resize-none`}
                      rows={4}
                      placeholder="Share your experience..."
                    />
                  </div>
                  <button
                    type="submit"
                    className={`w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${btnPrimary[variant]}`}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    <Send size={16} />Submit Review
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
