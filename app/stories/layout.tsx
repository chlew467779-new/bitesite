/* bitesite/app/stories/layout.tsx */

import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Stories | BiteSite — Restaurant News & Openings",
  description:
    "Discover new restaurant openings, hidden gems, and food stories from Klang Valley and beyond.",
  alternates: {
    canonical: `${siteUrl}/stories`,
  },
  openGraph: {
    title: "Stories | BiteSite",
    description: "Discover local restaurants, new openings & hidden gems from Klang Valley and beyond.",
    url: `${siteUrl}/stories`,
    type: "website",
  },
};

export default function StoriesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
