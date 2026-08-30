/* bitesite/app/layout.tsx */

import type { Metadata } from "next";
import { Inter, Playfair_Display, Noto_Sans_JP } from "next/font/google";
import { SiteHeader } from "@/components/sections/site-header";
import { getSettings } from "@/lib/settings";
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return {
    title: `${settings.site_title} | Every Bite Tells a Story`,
    description: settings.site_description,
    keywords: [
      "restaurant",
      "KL cafe",
      "Kuala Lumpur food",
      "discover restaurants",
      "local dining",
      "food stories",
      settings.site_title,
    ],
    authors: [{ name: settings.site_title }],
    creator: settings.site_title,
    metadataBase: new URL("https://bitesite-pied.vercel.app"),
    openGraph: {
      title: `${settings.site_title} | Every Bite Tells a Story`,
      description: settings.site_description,
      url: "https://bitesite-pied.vercel.app",
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

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.site_title,
    url: "https://bitesite-pied.vercel.app",
    description: settings.site_description,
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.site_title,
    url: "https://bitesite-pied.vercel.app",
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${notoSansJP.variable}`}
    >
      <body className="min-h-screen bg-[#FAFBF7] font-sans antialiased">
        <SiteHeader />
        <main>{children}</main>
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
      </body>
    </html>
  );
}
