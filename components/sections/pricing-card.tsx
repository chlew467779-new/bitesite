"use client";

import { FadeIn } from "@/app/components/animations";
import { MessageCircle } from "lucide-react";
import { BITESITE_WHATSAPP_URL } from "@/lib/whatsapp";
import { trackEvent } from "@/lib/analytics";

export function PricingCard() {
  return (
    <FadeIn>
      <section
        className="px-4 py-20 sm:px-6 lg:px-8"
        style={{ backgroundColor: "#FAFBF7" }}
      >
        <div className="mx-auto max-w-md">
          <div className="rounded-xl border-2 border-[#5A8F6E] bg-white p-8 text-center sm:p-10">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[#8A968B]">Free partner programme</p>
            <div className="mb-2 font-serif text-5xl font-bold text-[#2C3E2D]">RM 0</div>
            <p className="mb-6 text-sm text-[#6B6560]">No setup fee. No monthly fee. No commission.</p>
            <div className="mb-8 rounded-xl bg-[#F0F4EC] p-4 text-left text-sm leading-6 text-[#6B6560]">
              In return, partners keep their listing useful by sharing Stories regularly: new menus, launches, events, offers, or moments from the team.
            </div>
            <a
              href={BITESITE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("whatsapp_click", { pageType: "join_us", detail: "pricing_cta" })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#5A8F6E] px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <MessageCircle size={18} />
              Ask about joining
            </a>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
