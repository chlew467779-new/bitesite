/* bitesite/app/layout.tsx */

import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_SC } from "next/font/google";
import { SiteHeader } from "@/components/sections/site-header";
import { getSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/safe-json-ld.mjs";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Chinese glyphs are split into unicode-range chunks; only pages with 中文 download them.
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteUrl = getSiteUrl();

  return {
    title: `${settings.site_title} | Every Bite Tells a Story`,
    description: settings.site_description,
    keywords: [
      "restaurant",
      "Malaysia cafe",
      "Malaysia food",
      "discover restaurants",
      "local dining",
      "food stories",
      settings.site_title,
    ],
    authors: [{ name: settings.site_title }],
    creator: settings.site_title,
    metadataBase: new URL(siteUrl),
    openGraph: {
      title: `${settings.site_title} | Every Bite Tells a Story`,
      description: settings.site_description,
      url: siteUrl,
      siteName: settings.site_title,
      locale: "en_MY",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${settings.site_title} | Every Bite Tells a Story`,
      description: settings.site_description,
    },
    verification: {
      google: "uBOqQMI8xgJcUJVyR_mezk4PAY66QMUTrcenNUPcjWs",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  const siteUrl = getSiteUrl();

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.site_title,
    url: siteUrl,
    description: settings.site_description,
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.site_title,
    url: siteUrl,
  };

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${notoSansSC.variable}`}
    >
      <body className="min-h-screen bg-white font-sans text-ink antialiased">
        <SiteHeader />
        <main>{children}</main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(websiteSchema),
          }}
        />
      </body>
    </html>
  );
}
