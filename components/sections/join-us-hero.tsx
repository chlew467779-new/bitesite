"use client";

import { FadeIn } from "@/app/components/animations";
import { ArrowRight } from "lucide-react";
import { BITESITE_WHATSAPP_URL } from "@/lib/whatsapp";

export function JoinUsHero() {
  return (
    <FadeIn direction="up" duration={0.6}>
      <section
        className="relative flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center"
        style={{ backgroundColor: "#FAFBF7" }}
      >
        <div className="relative z-10 mx-auto max-w-2xl">
          <h1 className="mb-5 font-serif text-3xl font-medium leading-tight tracking-tight text-[#2C3E2D] sm:text-4xl md:text-5xl lg:text-6xl">
            Beautiful Menus for
            <br />
            Local Restaurants
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#6B6560] md:text-lg">
            No app downloads. No commissions.
            <br />
            Just a stunning digital menu that brings customers to your door.
          </p>
          <a
            href={BITESITE_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#5A8F6E] px-8 py-4 text-base font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Get Started
            <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </FadeIn>
  );
}
