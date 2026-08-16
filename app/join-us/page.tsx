import type { Metadata } from "next";
import { JoinUsHero } from "@/components/sections/join-us-hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { PricingCard } from "@/components/sections/pricing-card";
import { FaqAccordion } from "@/components/sections/faq-accordion";
import { JoinUsCta } from "@/components/sections/join-us-cta";
import { Footer } from "@/components/sections/footer";

export const metadata: Metadata = {
  title: "Join BiteSite — Beautiful Menus for Local Restaurants",
  description:
    "Join BiteSite and get a stunning digital menu page for your restaurant. No app downloads, no commissions. Setup RM599 + RM149/month.",
  openGraph: {
    title: "Join BiteSite — Beautiful Menus for Local Restaurants",
    description:
      "Join BiteSite and get a stunning digital menu page for your restaurant. No app downloads, no commissions. Setup RM599 + RM149/month.",
    type: "website",
  },
};

export default function JoinUsPage() {
  return (
    <main>
      <JoinUsHero />
      <HowItWorks />

      {/* What's Included */}
      <section
        className="px-4 py-20 sm:px-6 lg:px-8"
        style={{ backgroundColor: "#FAFBF7" }}
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center font-serif text-2xl font-bold text-[#2C3E2D] md:text-3xl">
            What&apos;s Included
          </h2>
          <ul className="space-y-4">
            {[
              "Custom branded menu page",
              "5 layout styles (classic / elegant / minimal / modern / rustic)",
              "Photo gallery & video support",
              "WhatsApp / Call CTA buttons",
              "View count analytics",
              "Monthly content updates",
              "SEO-friendly page",
              "Share buttons (WhatsApp / FB / IG)",
              '"Open Now" badge',
            ].map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-3 text-[#6B6560]"
              >
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5A8F6E]/10 text-[#5A8F6E]">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="text-base">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PricingCard />
      <FaqAccordion />
      <JoinUsCta />
      <Footer />
    </main>
  );
}
