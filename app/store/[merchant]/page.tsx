import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { layouts } from "@/app/layouts";

interface PageProps {
  params: Promise<{ merchant: string }>;
}

export default async function MerchantPage({ params }: PageProps) {
  const { merchant: slug } = await params;

  const supabase = await createClient();

  // Fetch merchant
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (merchantError || !merchant) {
    notFound();
  }

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("sort_order", { ascending: true });

  // Fetch products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("is_available", true)
    .order("sort_order", { ascending: true });

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
