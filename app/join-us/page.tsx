/* bitesite/app/join-us/page.tsx */

import { JOIN_US_FAQS } from "@/lib/join-us-faq";
import type { Metadata } from "next";
import { JoinPage } from "@/components/join/join-page";
import { Footer } from "@/components/sections/footer";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { safeJsonLd } from "@/lib/safe-json-ld.mjs";
import { createClient } from "@supabase/supabase-js";

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

/** Why new restaurants cannot submit right now (#34), shown near the top; null when open. */
async function getIntakeReason(): Promise<"paused" | "full" | "busy" | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { data, error } = await createClient(url, key).rpc("pilot_intake_status");
    const reason = error ? null : (data as { reason?: string } | null)?.reason;
    return reason === "paused" || reason === "full" || reason === "busy" ? reason : null;
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
  const [partnerCount, intake] = await Promise.all([getPartnerCount(), getIntakeReason()]);
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
      <main className="min-h-screen bg-page text-ink">
        <JoinPage partnerCount={partnerCount} intake={intake} />
        <Footer />
      </main>
    </>
  );
}
