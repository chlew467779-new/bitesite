"use client";

import { MapPin, Phone, MessageCircle, Clock } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import type { LayoutProps } from "@/types";

export default function RusticLayout({
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
    <div className="min-h-screen bg-[#f5f0e8] text-[#3d3229]">
      {/* Mobile Back Navigation */}
      <nav className="w-full px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-[#f5f0e8]/90 border-b border-[#3d3229]/10">
        <a
          href="/"
          className="text-sm text-[#3d3229]/60 active:text-[#3d3229] active:scale-95 transition-all duration-150 flex items-center gap-1.5 select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back to BiteSite</span>
          <span className="sm:hidden">Back</span>
        </a>
      </nav>

      {/* Warm Hero */}
      <FadeIn direction="up">
        <div className="relative h-[60vh] w-full overflow-hidden">
          <SafeImage
            src={merchant.cover_image}
            alt={merchant.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[#3d3229]/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-6">
              <span className="text-[#d4a574] text-sm tracking-[0.3em] uppercase block mb-4">
                {merchant.cuisine_type}
              </span>
              <h1 className="text-4xl md:text-7xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: 'serif' }}>
                {merchant.name}
              </h1>
              <p className="text-white/80 max-w-md mx-auto leading-relaxed text-base">
                {merchant.description}
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Info Cards */}
      <div className="max-w-5xl mx-auto px-6 -mt-16 relative z-10">
        <div className="grid md:grid-cols-3 gap-4">
          <FadeIn delay={0.1}>
            <div className="bg-white p-6 rounded-lg shadow-lg text-center active:scale-[0.98] transition-transform duration-150">
              <MapPin className="w-6 h-6 text-[#8b6914] mx-auto mb-3" />
              <h3 className="font-semibold text-[#3d3229] mb-1 tracking-wide">Visit Us</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{merchant.address}</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <a
              href={merchant.phone ? `tel:${merchant.phone.replace(/\s/g, "")}` : "#"}
              className="block bg-white p-6 rounded-lg shadow-lg text-center active:scale-[0.98] transition-transform duration-150"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Phone className="w-6 h-6 text-[#8b6914] mx-auto mb-3" />
              <h3 className="font-semibold text-[#3d3229] mb-1 tracking-wide">Call</h3>
              <p className="text-sm text-stone-500">{merchant.phone || "N/A"}</p>
            </a>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
              <Clock className="w-6 h-6 text-[#8b6914] mx-auto mb-3" />
              <h3 className="font-semibold text-[#3d3229] mb-1 tracking-wide">Hours</h3>
              {merchant.operating_hours ? (
                <div className="text-sm text-stone-500 space-y-1">
                  {Object.entries(merchant.operating_hours).slice(0, 1).map(([day, hours]) => (
                    <p key={day} className="leading-relaxed">{day}: {hours}</p>
                  ))}
                  <p className="text-xs opacity-60">See all hours below</p>
                </div>
              ) : (
                <p className="text-sm text-stone-500">Open Daily</p>
              )}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* WhatsApp */}
      {merchant.whatsapp && (
        <FadeIn delay={0.2}>
          <div className="max-w-5xl mx-auto px-6 py-10 text-center">
            <a
              href={`https://wa.me/${merchant.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#8b6914] active:bg-[#6b5010] text-white rounded-full font-medium active:scale-[0.98] transition-all duration-150 shadow-md select-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </a>
          </div>
        </FadeIn>
      )}

      {/* Menu - Warm Cards */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {categories.map((category, catIndex) => {
          const categoryProducts = getProductsByCategory(category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <FadeIn key={category.id} delay={catIndex * 0.1}>
              <section className="mb-16">
                <h2 className="text-2xl font-bold text-[#3d3229] mb-8 text-center tracking-wide">
                  {category.name}
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {categoryProducts.map((product, prodIndex) => (
                    <FadeIn key={product.id} delay={prodIndex * 0.05}>
                      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#3d3229]/5 active:scale-[0.99] active:shadow-md transition-all duration-150">
                        {product.image_url && (
                          <div className="relative h-48 w-full overflow-hidden">
                            <SafeImage
                              src={product.image_url}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 50vw"
                            />
                          </div>
                        )}
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-[#3d3229] text-base leading-snug tracking-wide">
                              {product.name}
                            </h3>
                            {product.show_prices !== false && product.price > 0 && (
                              <span className="text-[#8b6914] font-bold text-sm whitespace-nowrap tracking-wide">
                                {product.discount_price ? (
                                  <>
                                    <span className="line-through text-stone-400 mr-1 text-xs">
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
                            <p className="text-sm text-stone-500 leading-relaxed">
                              {product.description}
                            </p>
                          )}
                          {product.is_available === false && (
                            <span className="inline-block mt-2 text-xs text-red-500 font-medium">
                              Currently Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </section>
            </FadeIn>
          );
        })}
      </div>

      {/* Operating Hours Detail */}
      {merchant.operating_hours && (
        <FadeIn>
          <div className="max-w-2xl mx-auto px-6 pb-16">
            <h3 className="text-center text-lg font-semibold text-[#3d3229] mb-6 tracking-wide">
              Opening Hours
            </h3>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              {Object.entries(merchant.operating_hours).map(([day, hours]) => (
                <div key={day} className="flex justify-between py-2 border-b border-stone-100 last:border-0">
                  <span className="text-sm text-stone-500 capitalize leading-relaxed">{day}</span>
                  <span className="text-sm font-medium text-[#3d3229]">{hours}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Footer */}
      <footer className="bg-[#3d3229] text-[#d4a574]/60 py-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
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
