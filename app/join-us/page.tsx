/* bitesite/app/join-us/page.tsx */

import type { Metadata } from "next";
import { JoinUsHero } from "@/components/sections/join-us-hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { PricingCard } from "@/components/sections/pricing-card";
import { FaqAccordion } from "@/components/sections/faq-accordion";
import { JoinUsCta } from "@/components/sections/join-us-cta";
import { Footer } from "@/components/sections/footer";
import { PageViewTracker } from "@/app/components/page-view-tracker";

export const metadata: Metadata = {
  title: "Join BiteSite — Every Bite Tells a Story",
  description:
    "Join BiteSite's free partner programme. Get discovered by local diners, share regular restaurant Stories, and let BiteSite help amplify suitable updates on social media.",
  openGraph: {
    title: "Join BiteSite — Every Bite Tells a Story",
    description:
    "Join BiteSite for free, share your restaurant's story regularly, and reach more local diners.",
    type: "website",
  },
};

export default function JoinUsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is it really free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. There is no setup fee, monthly fee, or commission for the BiteSite partner programme. Partners agree to keep their listing useful by sharing Stories regularly.",
        },
      },
      {
        "@type": "Question",
        name: "What do partners need to contribute?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Partners should share useful restaurant updates regularly, such as new menus, launches, offers, events, behind-the-scenes moments, or founder stories. Original information and image rights remain important.",
        },
      },
      {
        "@type": "Question",
        name: "Will BiteSite promote my Stories?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BiteSite may reshare suitable Stories on our Facebook, Instagram, and other social channels. We will choose content that fits the channel and cannot guarantee that every Story will be reshared.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to download an app?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Customers simply open your BiteSite link. Partners can work with us through the web and WhatsApp.",
        },
      },
      {
        "@type": "Question",
        name: "Can I update my listing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Merchants can update approved listing details from the Merchant dashboard. Name, address, slug, and business status changes go through a review request.",
        },
      },
      {
        "@type": "Question",
        name: "How do I join?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Send us a message on WhatsApp with your restaurant name, area, and best contact email. We will explain the next steps and invite you when ready.",
        },
      },
    ],
  };

  return (
    <>
      <PageViewTracker pageType="join_us" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
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
