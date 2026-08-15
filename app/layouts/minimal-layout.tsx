"use client";

import { MapPin, Phone, MessageCircle } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import type { LayoutProps } from "@/types";

export default function MinimalLayout({
  merchant,
  categories,
  products,
  videos,
  features,
}: LayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  return (
    <div className="min-h-screen bg-[#fefefe] text-stone-700">
      {/* Mobile Back Navigation */}
      <nav className="w-full px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-[#fefefe]/90 border-b border-stone-200/50">
        <a
          href="/"
          className="text-sm text-stone-400 active:text-stone-700 active:scale-95 transition-all duration-150 flex items-center gap-1.5 select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back to BiteSite</span>
          <span className="sm:hidden">Back</span>
        </a>
      </nav>

      {/* Minimal Hero */}
      <FadeIn direction="up">
        <div className="max-w-3xl mx-auto px-6 pt-12 pb-8 text-center">
          <span className="text-stone-400 text-xs tracking-[0.3em] uppercase block mb-6">
            {merchant.cuisine_type}
          </span>
          <h1 className="text-3xl md:text-5xl font-light text-stone-800 mb-6 tracking-wide leading-tight">
            {merchant.name}
          </h1>
          <div className="w-12 h-[1px] bg-stone-300 mx-auto mb-6" />
          <p className="text-stone-500 leading-relaxed max-w-lg mx-auto text-base">
            {merchant.description}
          </p>
        </div>
      </FadeIn>

      {/* Cover Image */}
      <FadeIn delay={0.1}>
        <div className="max-w-4xl mx-auto px-6 mb-12">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm">
            <SafeImage
              src={merchant.cover_image}
              alt={merchant.name}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
        </div>
      </FadeIn>

      {/* Info */}
      <div className="max-w-3xl mx-auto px-6 pb-12 flex flex-wrap justify-center gap-6 text-sm text-stone-500">
        {merchant.address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 active:scale-95 transition-transform duration-150"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <MapPin className="w-4 h-4" />
            <span className="leading-relaxed">{merchant.address}</span>
          </a>
        )}
        {merchant.phone && (
          <a
            href={`tel:${merchant.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 active:scale-95 transition-transform duration-150"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Phone className="w-4 h-4" />
            <span>{merchant.phone}</span>
          </a>
        )}
      </div>

      {/* WhatsApp */}
      {merchant.whatsapp && (
        <FadeIn delay={0.1}>
          <div className="max-w-3xl mx-auto px-6 pb-16 text-center">
            <a
              href={`https://wa.me/${merchant.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 border border-stone-300 text-stone-600 active:bg-stone-800 active:text-white active:border-stone-800 active:scale-[0.98] transition-all text-sm tracking-widest uppercase select-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              WhatsApp
            </a>
          </div>
        </FadeIn>
      )}

      {/* Menu - Clean List */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        {categories.map((category, catIndex) => {
          const categoryProducts = getProductsByCategory(category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <FadeIn key={category.id} delay={catIndex * 0.1}>
              <section className="mb-16">
                <h2 className="text-center text-xs tracking-[0.3em] uppercase text-stone-400 mb-8">
                  {category.name}
                </h2>
                <div className="space-y-6">
                  {categoryProducts.map((product, prodIndex) => (
                    <FadeIn key={product.id} delay={prodIndex * 0.05}>
                      <div className="flex gap-4 items-start active:scale-[0.99] transition-transform duration-150">
                        {product.image_url && (
                          <div className="w-20 h-20 flex-shrink-0 overflow-hidden rounded-sm">
                            <SafeImage
                              src={product.image_url}
                              alt={product.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-stone-800 font-medium text-base leading-snug tracking-wide">
                              {product.name}
                            </h3>
                            {product.show_prices !== false && product.price > 0 && (
                              <span className="text-stone-500 text-sm whitespace-nowrap tracking-wide">
                                {product.discount_price ? (
                                  <>
                                    <span className="line-through text-stone-300 mr-1 text-xs">
                                      RM {product.price}
                                    </span>
                                    RM {product.discount_price}
                                  </>
                                ) : (
                                  `RM ${product.price}`
                                )}
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-sm text-stone-400 mt-1 leading-relaxed">
                              {product.description}
                            </p>
                          )}
                          {product.is_available === false && (
                            <span className="inline-block mt-1 text-xs text-red-400">
                              Currently Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>
                {catIndex < categories.length - 1 && (
                  <div className="w-8 h-[1px] bg-stone-200 mx-auto mt-12" />
                )}
              </section>
            </FadeIn>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-10">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm opacity-60 active:opacity-100 active:scale-95 transition-all duration-200 select-none"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Discover more restaurants
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <p className="mt-4 text-xs opacity-40">
            Powered by BiteSite
          </p>
        </div>
      </footer>
    </div>
  );
}
