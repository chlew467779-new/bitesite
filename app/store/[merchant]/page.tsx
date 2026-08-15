import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
  getVideosByMerchant,
} from "@/lib/supabase";
import { layouts } from "@/app/layouts";

// ── 动态 SEO ──
export async function generateMetadata({
  params,
}: {
  params: { merchant: string };
}): Promise<Metadata> {
  const merchant = await getMerchantBySlug(params.merchant);

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
    openGraph: {
      title: `${merchant.name} — ${merchant.cuisine_type ?? "Restaurant"}`,
      description: merchant.description || `Menu & opening hours for ${merchant.name}`,
      images: merchant.cover_image ? [{ url: merchant.cover_image }] : [],
      type: "website",
      locale: "en_MY",
    },
    twitter: {
      card: "summary_large_image",
      title: merchant.name,
      description,
      images: merchant.cover_image ? [merchant.cover_image] : [],
    },
  };
}

// ── 页面组件 ──
export default async function MerchantPage({
  params,
}: {
  params: { merchant: string };
}) {
  const merchant = await getMerchantBySlug(params.merchant);
  if (!merchant) notFound();

  const [categories, products, videos] = await Promise.all([
    getCategoriesByMerchant(merchant.id),
    getProductsByMerchant(merchant.id),
    getVideosByMerchant(merchant.id),
  ]);

  const layoutKey = merchant.layout || "classic";
  const LayoutComponent = layouts[layoutKey as keyof typeof layouts];

  // Schema.org JSON-LD
  const dayMap: Record<string, string> = {
    monday: "Mo",
    tuesday: "Tu",
    wednesday: "We",
    thursday: "Th",
    friday: "Fr",
    saturday: "Sa",
    sunday: "Su",
  };

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: merchant.name,
    image: merchant.cover_image,
    description: merchant.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: merchant.address,
      addressLocality: "Kuala Lumpur",
      addressCountry: "MY",
    },
    telephone: merchant.phone,
    priceRange: "$$",
    servesCuisine: merchant.cuisine_type,
    url: `https://bitesite-pied.vercel.app/store/${merchant.slug}`,
    openingHours: Object.entries(merchant.operating_hours || {}).map(
      ([day, time]) => `${dayMap[day] || day} ${time}`
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      <LayoutComponent
        merchant={merchant}
        categories={categories}
        products={products}
        videos={videos}
        features={merchant.features}
      />
    </>
  );
}
