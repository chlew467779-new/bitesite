"use client";

import { FadeIn } from "@/app/components/animations";
import { MessageCircle } from "lucide-react";
import { BITESITE_WHATSAPP_URL } from "@/lib/whatsapp";

export function JoinUsCta() {
  return (
    <FadeIn>
      <section
        className="px-4 py-20 sm:px-6 lg:px-8"
        style={{ backgroundColor: "#F0F4EC" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-6 font-serif text-2xl font-bold text-[#2C3E2D] md:text-3xl">
            Ready to get started?
          </h2>
          <a
            href={BITESITE_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#5A8F6E] px-8 py-4 text-base font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <MessageCircle size={20} />
            Chat with us on WhatsApp
          </a>
        </div>
      </section>
    </FadeIn>
  );
}
