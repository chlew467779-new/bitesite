import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
  getVideosByMerchant,
} from "@/lib/supabase";
import { layouts } from "@/app/layouts";

// ── SEO: 每个商家页有独立的 title / description / OG 图 ──
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
    title: `${merchant.name} | ${merchant.cuisine_type} Menu | BiteSite`,
    description,
    openGraph: {
      title: `${merchant.name} — ${merchant.cuisine_type}`,
      description: merchant.description || `Menu & opening hours for ${merchant.name}`,
      images: merchant.cover_image ? [{ url: merchant.cover_image }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: merchant.name,
      description,
      images: merchant.cover_image ? [merchant.cover_image] : [],
    },
  };
}

// ── 页面组件（和原来一样）──
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

  return (
    <LayoutComponent
      merchant={merchant}
      categories={categories}
      products={products}
      videos={videos}
      features={merchant.features}
    />
  );
}
