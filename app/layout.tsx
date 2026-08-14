import type { Metadata } from "next";
import { Inter, Playfair_Display, Noto_Sans_JP } from "next/font/google";
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

export const metadata: Metadata = {
  title: "BiteSite | Beautiful Menus for Local Restaurants",
  description:
    "Discover beautiful menu pages for cafes and restaurants in Kuala Lumpur. Browse photos, find contact info, and get directions.",
  keywords: ["restaurant menu", "KL cafe", "Kuala Lumpur food", "menu showcase"],
  openGraph: {
    title: "BiteSite | Beautiful Menus for Local Restaurants",
    description:
      "Discover beautiful menu pages for cafes and restaurants in Kuala Lumpur.",
    type: "website",
    locale: "en_MY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${notoSansJP.variable}`}
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
