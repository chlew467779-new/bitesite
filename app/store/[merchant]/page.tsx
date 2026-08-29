/* bitesite/app/store/[merchant]/page.tsx */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
  getVideosByMerchant,
  getRelatedMerchants,
  getEventsByMerchant,
} from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { layouts } from "@/app/layouts";
import { RelatedMerchants } from "@/components/sections/related-merchants";
import { ViewTracker } from "@/components/sections/view-tracker";
import { PageViewTracker } from "@/app/components/page-view-tracker";

type PageProps = {
  params: Promise<{ merchant: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { merchant: slug } = await params;
  if (!slug) {
    return {
      title: "Restaurant Not Found | BiteSite",
      description: "The restaurant you are looking for could not be found.",
    };
  }
  const merchant = await getMerchantBySlug(slug);
  if (!merchant) {
    return {
      title: "Restaurant Not Found | BiteSite",
      description: "The restaurant you are looking for could not be found.",
    };
  }
  const description = merchant.description
    ? merchant.description.length > 155
      ? merchant.description.slice(0, 155) + "..."
      : merchant.description
    : `View the full menu, photos and opening hours for ${merchant.name} in Kuala Lumpur.`;
  const ogImage = merchant.cover_image
    ? merchant.cover_image.startsWith("http")
      ? merchant.cover_image
      : `https://bitesite-pied.vercel.app${merchant.cover_image}`
    : null;
  const canonicalUrl = `https://bitesite-pied.vercel.app/store/${merchant.slug}`;
  return {
    title: `${merchant.name} | ${merchant.cuisine_type ?? "Restaurant"} Menu | BiteSite`,
    description,
    keywords: [
      merchant.name,
      merchant.cuisine_type ?? "restaurant",
      "menu",
      "Kuala Lumpur",
      "restaurant",
      "cafe",
      "KL food",
    ],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${merchant.name} — ${merchant.cuisine_type ?? "Restaurant"}`,
      description: merchant.description || `Menu & opening hours for ${merchant.name}`,
      images: ogImage ? [{ url: ogImage }] : [],
      type: "website",
      locale: "en_MY",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: merchant.name,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function MerchantPage({ params }: PageProps) {
  const { merchant: slug } = await params;
  if (!slug) notFound();
  const merchant = await getMerchantBySlug(slug);
  if (!merchant) notFound();

  const [categories, products, videos, relatedMerchants, statsRes, events] = await Promise.all([
    getCategoriesByMerchant(merchant.id),
    getProductsByMerchant(merchant.id),
    getVideosByMerchant(merchant.id),
    getRelatedMerchants(merchant.slug, merchant.cuisine_type, merchant.tags, merchant.area, 3),
    supabase.from("merchant_stats").select("view_count").eq("slug", slug).single(),
    getEventsByMerchant(merchant.id),
  ]);

  const viewCount = statsRes.data?.view_count || 0;
  const layoutKey = merchant.layout || "classic";
  const LayoutComponent = layouts[layoutKey as keyof typeof layouts];
  if (!LayoutComponent) notFound();

  const canonicalUrl = `https://bitesite-pied.vercel.app/store/${merchant.slug}`;
  const dayMap: Record<string, string> = {
    monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th",
    friday: "Fr", saturday: "Sa", sunday: "Su",
  };
  const schemaData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: merchant.name,
    image: merchant.cover_image,
    description: merchant.description,
    priceRange: "$$",
    url: canonicalUrl,
  };
  if (merchant.address) {
    schemaData.address = {
      "@type": "PostalAddress",
      streetAddress: merchant.address,
      addressLocality: "Kuala Lumpur",
      addressCountry: "MY",
    };
  }
  if (merchant.phone) schemaData.telephone = merchant.phone;
  if (merchant.cuisine_type) schemaData.servesCuisine = merchant.cuisine_type;
  
  schemaData.hasMenu = {
    "@type": "Menu",
    name: "Menu",
    url: `${canonicalUrl}#menu-section`,
  };
  
  if (merchant.operating_hours && typeof merchant.operating_hours === "object") {
    schemaData.openingHours = Object.entries(merchant.operating_hours).map(
      ([day, time]) => `${dayMap[day] || day} ${time}`
    );
  }
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://bitesite-pied.vercel.app" },
      { "@type": "ListItem", position: 2, name: merchant.name, item: canonicalUrl },
    ],
  };

  return (
    <>
      <PageViewTracker pageType="merchant" slug={merchant.slug} />
      <ViewTracker slug={merchant.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <LayoutComponent
        merchant={merchant}
        categories={categories}
        products={products}
        videos={videos}
        features={merchant.features}
        viewCount={viewCount}
        events={events}
      />
      <RelatedMerchants
        merchants={relatedMerchants}
        variant={layoutKey as "classic" | "elegant" | "minimal" | "modern" | "rustic"}
      />
    </>
  );
}
