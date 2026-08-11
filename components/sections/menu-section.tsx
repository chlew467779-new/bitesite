import { ProductCard } from "./product-card";
import type { Category, Product } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface MenuSectionProps {
  category: Category;
  products: Product[];
  merchantName: string;
  style: StyleConfig;
}

export function MenuSection({ category, products, merchantName, style }: MenuSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="px-4 py-12 md:py-16" style={{ backgroundColor: style.bg }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h2 className="inline-block text-2xl font-medium md:text-3xl" style={{ fontFamily: style.fontSerif, color: style.text }}>
            {category.name}
          </h2>
          <div className="mx-auto mt-2 h-px w-16" style={{ backgroundColor: style.border }} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} merchantName={merchantName} style={style} />
          ))}
        </div>
      </div>
    </section>
  );
}
