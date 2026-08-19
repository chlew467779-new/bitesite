/* bitesite/app/stories/layout.tsx */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stories | BiteSite — KL Restaurant News & Openings",
  description:
    "Discover the best new restaurant openings, hidden gems, and food stories in Kuala Lumpur. BiteSite Stories covers KL's vibrant dining scene.",
  alternates: {
    canonical: "https://bitesite-pied.vercel.app/stories",
  },
  openGraph: {
    title: "Stories | BiteSite",
    description: "Discover local restaurants, new openings & hidden gems in Kuala Lumpur.",
    url: "https://bitesite-pied.vercel.app/stories",
    type: "website",
  },
};

export default function StoriesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
