import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
  getVideosByMerchant,
} from "@/lib/supabase";
import { layouts } from "@/app/layouts";

// Next.js 15: params is a Promise
type PageProps = {
  params: Promise<{ merchant: string }>;
};

// ── 动态 SEO ──
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
export default async function MerchantPage({ params }: PageProps) {
  const { merchant: slug } = await params;

  if (!slug) {
    notFound();
  }

  const merchant = await getMerchantBySlug(slug);
  if (!merchant) {
    notFound();
  }

  const [categories, products, videos] = await Promise.all([
    getCategoriesByMerchant(merchant.id),
    getProductsByMerchant(merchant.id),
    getVideosByMerchant(merchant.id),
  ]);

  const layoutKey = merchant.layout || "classic";
  const LayoutComponent = layouts[layoutKey as keyof typeof layouts];

  if (!LayoutComponent) {
    notFound();
  }

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

  const schemaData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: merchant.name,
    image: merchant.cover_image,
    description: merchant.description,
    priceRange: "$$",
    url: `https://bitesite-pied.vercel.app/store/${merchant.slug}`,
  };

  if (merchant.address) {
    schemaData.address = {
      "@type": "PostalAddress",
      streetAddress: merchant.address,
      addressLocality: "Kuala Lumpur",
      addressCountry: "MY",
    };
  }

  if (merchant.phone) {
    schemaData.telephone = merchant.phone;
  }

  if (merchant.cuisine_type) {
    schemaData.servesCuisine = merchant.cuisine_type;
  }

  if (merchant.operating_hours && typeof merchant.operating_hours === "object") {
    schemaData.openingHours = Object.entries(merchant.operating_hours).map(
      ([day, time]) => `${dayMap[day] || day} ${time}`
    );
  }

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
