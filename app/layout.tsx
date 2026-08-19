/* bitesite/app/layout.tsx */

import type { Metadata } from "next";
import { Inter, Playfair_Display, Noto_Sans_JP } from "next/font/google";
import { SiteHeader } from "@/components/sections/site-header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata = {
  title: "BiteSite | Beautiful Menus for Local Restaurants",
  description:
    "Discover the best cafes, restaurants, and dessert shops in Kuala Lumpur. Browse menus, photos, opening hours, and book your table instantly.",
  keywords: [
    "restaurant menu",
    "KL cafe",
    "Kuala Lumpur food",
    "online menu",
    "restaurant website",
    "cafe menu",
    "food delivery",
    "BiteSite",
  ],
  authors: [{ name: "BiteSite" }],
  creator: "BiteSite",
  metadataBase: new URL("https://bitesite-pied.vercel.app"),
  openGraph: {
    title: "BiteSite | Beautiful Menus for Local Restaurants",
    description:
      "Discover the best cafes, restaurants, and dessert shops in Kuala Lumpur.",
    url: "https://bitesite-pied.vercel.app",
    siteName: "BiteSite",
    locale: "en_MY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BiteSite | Beautiful Menus for Local Restaurants",
    description:
      "Discover the best cafes, restaurants, and dessert shops in Kuala Lumpur.",
  },
  verification: {
    google: "uBOqQMI8xgJcUJVyR_mezk4PAY66QMUTrcenNUPcjWs",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BiteSite",
    url: "https://bitesite-pied.vercel.app",
    description: "Beautiful Menus for Local Restaurants in Kuala Lumpur.",
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BiteSite",
    url: "https://bitesite-pied.vercel.app",
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${notoSansJP.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
