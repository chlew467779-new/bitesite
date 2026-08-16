"use client";

import { FadeIn } from "@/app/components/animations";
import { MessageCircle } from "lucide-react";
import { BITESITE_WHATSAPP_URL } from "@/lib/whatsapp";

export function PricingCard() {
  return (
    <FadeIn>
      <section
        className="px-4 py-20 sm:px-6 lg:px-8"
        style={{ backgroundColor: "#FAFBF7" }}
      >
        <div className="mx-auto max-w-md">
          <div className="rounded-xl border-2 border-[#5A8F6E] bg-white p-8 text-center sm:p-10">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[#8A968B]">
              Pricing
            </p>
            <div className="mb-2 font-serif text-5xl font-bold text-[#2C3E2D]">
              RM 599
            </div>
            <p className="mb-6 text-sm text-[#6B6560]">One-time Setup</p>
            <div className="mb-8 flex items-center justify-center gap-3">
              <span className="h-px w-12 bg-[#DDE5DC]" />
              <span className="text-sm text-[#8A968B]">plus</span>
              <span className="h-px w-12 bg-[#DDE5DC]" />
            </div>
            <div className="mb-8 font-serif text-3xl font-bold text-[#2C3E2D]">
              RM 149
              <span className="ml-1 text-base font-normal text-[#6B6560]">
                / month
              </span>
            </div>
            <a
              href={BITESITE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#5A8F6E] px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <MessageCircle size={18} />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
