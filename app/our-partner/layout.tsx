/* bitesite/app/our-partner/layout.tsx */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Partner | BiteSite",
  description:
    "Explore all BiteSite partner restaurants on the map. Find cafes, bakeries, and restaurants near you in Kuala Lumpur.",
  alternates: {
    canonical: "https://bitesite-pied.vercel.app/our-partner",
  },
  openGraph: {
    title: "Our Partner | BiteSite",
    description: "Explore all BiteSite partner restaurants on the map.",
    url: "https://bitesite-pied.vercel.app/our-partner",
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
