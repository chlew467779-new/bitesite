import { notFound } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
  getVideosByMerchant,
} from "@/lib/supabase";
import { layouts } from "@/app/layouts";

interface PageProps {
  params: Promise<{ merchant: string }>;
}

export default async function MerchantPage({ params }: PageProps) {
  const { merchant: slug } = await params;

  const merchant = await getMerchantBySlug(slug);
  if (!merchant) {
    notFound();
  }

  const [categories, products, videos] = await Promise.all([
    getCategoriesByMerchant(merchant.id),
    getProductsByMerchant(merchant.id),
    getVideosByMerchant(merchant.id),
  ]);

  const defaultFeatures = {
    hero: true,
    about: true,
    menu: true,
    contact: true,
    gallery: false,
    reviews: false,
    appointment: false,
    seasonal_popup: false,
    events: false,
  };

  const features = {
    ...defaultFeatures,
    ...(merchant.features || {}),
  };

  const layoutKey = merchant.layout || "classic";
  const LayoutComponent = layouts[layoutKey as keyof typeof layouts];

  if (!LayoutComponent) {
    const FallbackLayout = layouts.classic;
    return (
      <FallbackLayout
        merchant={merchant}
        categories={categories}
        products={products}
        videos={videos}
        features={features}
      />
    );
  }

  return (
    <LayoutComponent
      merchant={merchant}
      categories={categories}
      products={products}
      videos={videos}
      features={features}
    />
  );
}
