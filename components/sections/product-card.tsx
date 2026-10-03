/* bitesite/components/sections/product-card.tsx */

import { DishDescription } from "./dish-description";
import type { Product } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface ProductCardProps {
  product: Product;
  merchantName: string;
  style: StyleConfig;
}

export function ProductCard({ product, merchantName, style }: ProductCardProps) {
  return (
    <div className="group overflow-hidden rounded-lg border transition-shadow duration-300 hover:shadow-md" style={{ backgroundColor: style.bg, borderColor: style.border }}>
      <div className="relative aspect-[4/3] overflow-hidden">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant dish image URLs may use any host
          <img
            src={product.image_url}
            alt={`${product.name} at ${merchantName}`}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ backgroundColor: style.bg2 }}>
            <span className="text-sm" style={{ color: style.muted }}>No image</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h4 className="text-base font-medium" style={{ fontFamily: style.fontSerif, color: style.text }}>
            {product.name}
          </h4>
          <span className="shrink-0 font-sans text-sm font-semibold" style={{ color: style.price }}>
            RM {product.price.toFixed(2)}
          </span>
        </div>
        {product.description && (
          <div style={{ color: style.text2 }}>
            <DishDescription description={product.description} clamp={false} className="text-sm leading-relaxed" />
          </div>
        )}
      </div>
    </div>
  );
}
