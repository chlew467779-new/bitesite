import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StoreHero } from "@/components/sections/store-hero";
import { BrandIntro } from "@/components/sections/brand-intro";
import { MenuSection } from "@/components/sections/menu-section";
import { InfoAccordion } from "@/components/sections/info-accordion";
import { VideoSection } from "@/components/sections/video-section";
import { StoreFooter } from "@/components/sections/store-footer";
import { TextImageBlock } from "@/components/sections/text-image-block";
import { DiscoverBiteSite } from "@/components/sections/discover-bitesite";
import { getStyleConfig } from "@/lib/styles";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
} from "@/lib/supabase";

type Params = Promise<{ merchant: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { merchant } = await params;
  const data = await getMerchantBySlug(merchant);

  if (!data) {
    return { title: "Not Found | BiteSite" };
  }

  const title = `${data.name} | ${data.cuisine_type || "Restaurant"} in KL`;
  const description =
    data.description?.replace(/\n/g, " ").slice(0, 150) ||
    `Discover ${data.name} in Kuala Lumpur. Browse the menu, view photos, and get directions.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: data.cover_image ? [data.cover_image] : [],
      type: "website",
      locale: "en_MY",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: data.cover_image ? [data.cover_image] : [],
    },
    alternates: {
      canonical: `https://bitesite.my/store/${merchant}`,
    },
  };
}

export default async function StorePage({ params }: { params: Params }) {
  const { merchant } = await params;
  const data = await getMerchantBySlug(merchant);

  if (!data) {
    notFound();
  }

  const title = `${data.name} | ${data.cuisine_type || "Restaurant"} in KL`;
  const description =
    data.description?.replace(/\n/g, " ").slice(0, 150) ||
    `Discover ${data.name} in Kuala Lumpur. Browse the menu, view photos, and get directions.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: data.cover_image ? [data.cover_image] : [],
      type: "website",
      locale: "en_MY",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: data.cover_image ? [data.cover_image] : [],
    },
    alternates: {
      canonical: `https://bitesite.my/store/${merchant}`,
    },
  };
}

export default async function StorePage({ params }: Props) {
  const { merchant } = params;
  const data = await getMerchantBySlug(merchant);

  if (!data) {
    notFound();
  }

  const style = getStyleConfig(data.style);
  const categories = await getCategoriesByMerchant(data.id);
  const products = await getProductsByMerchant(data.id);

  const productsByCategory = (catId: string) =>
    products.filter((p) => p.category_id === catId);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: data.name,
    description: data.description?.replace(/\n/g, " "),
    image: data.cover_image,
    address: {
      "@type": "PostalAddress",
      streetAddress: data.address,
      addressLocality: "Kuala Lumpur",
      addressCountry: "MY",
    },
    telephone: data.phone,
    url: `https://bitesite.my/store/${merchant}`,
    servesCuisine: data.cuisine_type,
    openingHoursSpecification: data.operating_hours
      ? Object.entries(data.operating_hours).map(([day, hours]) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: day.charAt(0).toUpperCase() + day.slice(1),
          description: hours,
        }))
      : undefined,
  };

  return (
    <main
      style={{
        backgroundColor: style.bg,
        color: style.text,
        fontFamily: style.fontSans,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StoreHero merchant={data} style={style} />
      <BrandIntro merchant={data} style={style} />

      {products.length > 0 && categories.length > 0 && (
        <TextImageBlock
          title="Signature Dishes"
          description={data.description || ""}
          imageUrl={products[0].image_url || data.cover_image || ""}
          imageAlt={`Signature dishes at ${data.name}`}
          style={style}
        />
      )}

      <VideoSection merchant={data} style={style} />

      {categories.map((cat) => (
        <MenuSection
          key={cat.id}
          category={cat}
          products={productsByCategory(cat.id)}
          merchantName={data.name}
          style={style}
        />
      ))}

      <InfoAccordion merchant={data} style={style} />
      <DiscoverBiteSite style={style} />
      <StoreFooter merchant={data} style={style} />
    </main>
  );
}
