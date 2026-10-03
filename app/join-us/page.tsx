/* bitesite/app/join-us/page.tsx */

import { JOIN_US_FAQS } from "@/lib/join-us-faq";
import type { Metadata } from "next";
import { JoinUsHero } from "@/components/sections/join-us-hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { PricingCard } from "@/components/sections/pricing-card";
import { FaqAccordion } from "@/components/sections/faq-accordion";
import { JoinUsCta } from "@/components/sections/join-us-cta";
import { PartnerCount } from "@/components/sections/partner-count";
import { Footer } from "@/components/sections/footer";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { safeJsonLd } from "@/lib/safe-json-ld.mjs";
import { createClient } from "@supabase/supabase-js";
import { intakeNotice } from "@/lib/merchant-review-core.mjs";

export const revalidate = 300;

async function getPartnerCount(): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { data, error } = await createClient(url, key).rpc("partner_count");
    return !error && Number.isSafeInteger(data) && data > 0 ? data : null;
  } catch {
    // The page stays usable before the migration is deployed or during a read failure.
    return null;
  }
}

/** Shown near the top when new restaurants cannot submit right now (#34); null otherwise. */
async function getIntakeNotice(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { data, error } = await createClient(url, key).rpc("pilot_intake_status");
    return error ? null : intakeNotice((data as { reason?: string } | null)?.reason);
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "Join BiteSite — Every Bite Tells a Story",
  description:
    "Join BiteSite's free partner programme. Get discovered by local diners, share regular restaurant Stories, and let BiteSite help amplify suitable updates on social media.",
  openGraph: {
    title: "Join BiteSite — Every Bite Tells a Story",
    description:
    "Join BiteSite for free, share your restaurant's story regularly, and reach more local diners.",
    type: "website",
    // Setting openGraph here replaces the root one, so the default share card is named again.
    images: ["/opengraph-image"],
  },
};

export default async function JoinUsPage() {
  const [partnerCount, intake] = await Promise.all([getPartnerCount(), getIntakeNotice()]);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: JOIN_US_FAQS.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <>
      <PageViewTracker pageType="join_us" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />
      <main>
        <JoinUsHero />
        {intake && (
          <div className="mx-auto max-w-3xl px-4 pt-6">
            <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{intake}</p>
          </div>
        )}
        {partnerCount !== null && <PartnerCount count={partnerCount} />}
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
                "Free BiteSite restaurant listing",
                "Custom profile with menu, photos, hours, and contact links",
                "Story submission workflow for restaurant updates",
                "Merchant dashboard to maintain approved details",
                "View count analytics as the product grows",
                "BiteSite editorial review and publishing",
                "Possible reshares on Facebook, Instagram, and other channels",
                "No setup fee, monthly fee, or commission",
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
    </>
  );
}
