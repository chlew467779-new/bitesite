import { notFound } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
} from "@/lib/supabase";
import { layouts } from "@/app/layouts";

interface PageProps {
  params: Promise<{ merchant: string }>;
}

export default async function MerchantPage({ params }: PageProps) {
  const { merchant: slug } = await params;

  // Fetch merchant
  const merchant = await getMerchantBySlug(slug);
  if (!merchant) {
    notFound();
  }

  // Fetch categories and products in parallel
  const [categories, products] = await Promise.all([
    getCategoriesByMerchant(merchant.id),
    getProductsByMerchant(merchant.id),
  ]);

  // Get layout component
  const layoutKey = merchant.layout || "classic";
  const LayoutComponent = layouts[layoutKey as keyof typeof layouts];

  if (!LayoutComponent) {
    // Fallback to classic if layout not found
    const FallbackLayout = layouts.classic;
    return (
      <FallbackLayout
        merchant={merchant}
        categories={categories || []}
        products={products || []}
      />
    );
  }

  return (
    <LayoutComponent
      merchant={merchant}
      categories={categories || []}
      products={products || []}
    />
  );
}
