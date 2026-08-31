/* bitesite/app/components/sections/events-section.tsx */

"use client";

import { FadeIn } from "@/app/components/animations";
import { SafeImage } from "@/app/components/safe-image";
import { MapPin, Clock } from "lucide-react";
import type { LayoutVariant } from "./gallery-section";
import type { EventItem } from "@/types";

interface EventsSectionProps {
  events: EventItem[];
  title?: string;
  variant?: LayoutVariant;
  id?: string;
}

const sectionBg: Record<LayoutVariant, string> = {
  classic: "bg-white",
  elegant: "bg-slate-900",
  minimal: "bg-stone-50",
  modern:  "bg-white",
  rustic:  "bg-amber-50",
};

const cardBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-50/50 border-amber-200",
  elegant: "bg-slate-800 border-slate-700",
  minimal: "bg-white border-stone-200",
  modern:  "bg-slate-50 border-slate-200",
  rustic:  "bg-white border-orange-200",
};

const textColor: Record<LayoutVariant, string> = {
  classic: "text-amber-900",
  elegant: "text-slate-100",
  minimal: "text-stone-800",
  modern:  "text-slate-800",
  rustic:  "text-orange-900",
};

const dateBadgeBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-700 text-white",
  elegant: "bg-amber-600 text-white",
  minimal: "bg-stone-800 text-white",
  modern:  "bg-slate-900 text-white",
  rustic:  "bg-orange-700 text-white",
};

export function EventsSection({
  events,
  title = "Upcoming Events",
  variant = "classic",
  id,
}: EventsSectionProps) {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <FadeIn>
      <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
        <div className="max-w-4xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-10 ${textColor[variant]}`}>{title}</h2>
          <div className="space-y-5">
            {events.map((event) => (
              <div
                key={event.id}
                className={`flex flex-col sm:flex-row gap-5 p-5 rounded-2xl border transition-transform active:scale-[0.98] touch-manipulation ${cardBg[variant]}`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className="flex-shrink-0">
                  <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center ${dateBadgeBg[variant]}`}>
                    <span className="text-xs font-medium uppercase tracking-wider opacity-80">
                      {new Date(event.date).toLocaleDateString("en-MY", { month: "short" })}
                    </span>
                    <span className="text-xl font-bold leading-none">
                      {new Date(event.date).getDate()}
                    </span>
                  </div>
                </div>
                {event.image && (
                  <div className="relative w-full sm:w-40 h-32 flex-shrink-0 rounded-xl overflow-hidden">
                    <SafeImage src={event.image} alt={event.title} fill className="object-cover" sizes="160px" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-xl font-bold mb-2 ${textColor[variant]}`}>{event.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                    {event.time && (
                      <span className={`text-sm flex items-center gap-1 opacity-60 ${textColor[variant]}`}>
                        <Clock size={13} />{event.time}
                      </span>
                    )}
                    {event.location && (
                      <span className={`text-sm flex items-center gap-1 opacity-60 ${textColor[variant]}`}>
                        <MapPin size={13} />{event.location}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className={`text-sm opacity-70 leading-relaxed line-clamp-3 ${textColor[variant]}`}>{event.description}</p>
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
