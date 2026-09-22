/* bitesite/app/our-partner/layout.tsx */

import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Our Partner | BiteSite",
  description:
    "Explore BiteSite partner restaurants on the map. Find cafes, bakeries, and restaurants across Klang Valley and beyond.",
  alternates: {
    canonical: `${siteUrl}/our-partner`,
  },
  openGraph: {
    title: "Our Partner | BiteSite",
    description: "Explore all BiteSite partner restaurants on the map.",
    url: `${siteUrl}/our-partner`,
    type: "website",
  },
};

export default function OurPartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
