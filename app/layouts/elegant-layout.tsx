"use client";

import { MapPin, Phone, Clock, MessageCircle, Instagram } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import type { LayoutProps } from "@/types";

export default function ElegantLayout({
  merchant,
  categories,
  products,
  videos,
  features,
}: LayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  const todayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    new Date().getDay()
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-200">
      {/* Back Navigation */}
      <nav className="w-full px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-black/60 border-b border-stone-800/50">
        <a
          href="/"
          className="text-sm text-white/50 active:text-white active:scale-95 transition-all duration-150 flex items-center gap-1.5 select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back to BiteSite</span>
          <span className="sm:hidden">Back</span>
        </a>
      </nav>

      {/* Full-screen Hero */}
      <FadeIn direction="up" duration={0.7}>
        <div className="relative h-[85vh] min-h-[500px] w-full overflow-hidden">
          <SafeImage
            src={merchant.cover_image}
            alt={merchant.name}
            fill
            className="object-cover opacity-60"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
          
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-16">
            <div className="max-w-5xl mx-auto w-full">
              <div className="w-16 md:w-20 h-[1px] bg-amber-500 mb-4 md:mb-6" />
              <span className="text-amber-500 tracking-[0.3em] text-xs md:text-sm uppercase mb-3 md:mb-4 block">
                {merchant.cuisine_type}
              </span>
              <h1 className="text-4xl md:text-8xl font-light text-white mb-4 md:mb-6 tracking-tight leading-tight">
                {merchant.name}
              </h1>
              <p className="text-stone-300 text-base md:text-xl max-w-2xl leading-relaxed font-light">
                {merchant.description}
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Info Section */}
      <div className="bg-[#111] border-t border-stone-800">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-10 md:py-12 grid md:grid-cols-3 gap-6 md:gap-8">
          <FadeIn delay={0.1}>
            <div>
              <h3 className="text-amber-500 text-xs tracking-[0.2em] uppercase mb-3">Location</h3>
              {merchant.address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-stone-400 active:text-amber-500 active:scale-[0.98] transition-all duration-150"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span className="text-sm leading-relaxed">{merchant.address}</span>
                </a>
              ) : (
                <span className="text-sm text-stone-600">Not available</span>
              )}
            </div>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <div>
              <h3 className="text-amber-500 text-xs tracking-[0.2em] uppercase mb-3">Contact</h3>
              {merchant.phone && (
                <a
                  href={`tel:${merchant.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 text-stone-400 active:text-amber-500 active:scale-[0.98] transition-all duration-150 mb-2"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{merchant.phone}</span>
                </a>
              )}
              {merchant.instagram && (
                <a
                  href={merchant.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-stone-400 active:text-amber-500 active:scale-[0.98] transition-all duration-150"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Instagram className="w-4 h-4" />
                  <span className="text-sm">Instagram</span>
                </a>
              )}
            </div>
          </FadeIn>
          
          <FadeIn delay={0.3}>
            <div>
              <h3 className="text-amber-500 text-xs tracking-[0.2em] uppercase mb-3">Reservations</h3>
              {merchant.whatsapp && (
                <a
                  href={`https://wa.me/${merchant.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2 border border-amber-500/50 text-amber-500 active:bg-amber-500 active:text-black active:scale-[0.98] transition-all text-sm tracking-wider uppercase select-none"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              {merchant.email && (
                <a
                  href={`mailto:${merchant.email}`}
                  className="block mt-2 text-sm text-stone-500 active:text-amber-500 transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {merchant.email}
                </a>
              )}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-16 md:py-20">
        <FadeIn>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-500 tracking-[0.3em] text-xs md:text-sm uppercase">Menu</span>
            <h2 className="text-3xl md:text-5xl font-light text-white mt-4 tracking-wide">Signature Dishes</h2>
          </div>
        </FadeIn>

        <div className="space-y-12 md:space-y-16">
          {categories.map((category, catIndex) => {
            const categoryProducts = getProductsByCategory(category.id);
            if (categoryProducts.length === 0) return null;

            return (
              <FadeIn key={category.id} delay={catIndex * 0.1}>
                <section>
                  <h3 className="text-xl md:text-2xl font-light text-amber-500 mb-6 md:mb-8 pb-4 border-b border-stone-800 tracking-wide">
                    {category.name}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    {categoryProducts.map((product, prodIndex) => (
                      <FadeIn key={product.id} delay={prodIndex * 0.05}>
                        <div className="flex gap-4 p-4 rounded-lg">
                          {product.image_url && (
                            <div className="relative w-24 h-24 md:w-28 md:h-28 flex-shrink-0 overflow-hidden rounded-lg">
                              <SafeImage
                                src={product.image_url}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 50vw, 25vw"
                              />
                            </div>
                          )}
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex justify-between items-baseline mb-2 gap-2">
                                <h4 className="text-base md:text-lg text-white font-light leading-snug tracking-wide">
                                  {product.name}
                                </h4>
                                {product.show_prices !== false && product.price > 0 && (
                                  <span className="text-amber-500 font-medium text-sm whitespace-nowrap tracking-wide">
                                    {product.discount_price ? (
                                      <>
                                        <span className="line-through text-stone-600 mr-1 text-xs">
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
                                <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">
                                  {product.description}
                                </p>
                              )}
                              {product.is_available === false && (
                                <span className="inline-block mt-2 text-xs text-red-400 font-medium">
                                  Currently Unavailable
                                </span>
                              )}
                            </div>
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
      </div>

      {/* Operating Hours */}
      {merchant.operating_hours && (
        <FadeIn>
          <div className="max-w-2xl mx-auto px-6 md:px-8 pb-16">
            <div className="text-center mb-8">
              <span className="text-amber-500 tracking-[0.3em] text-xs uppercase">Hours</span>
              <h3 className="text-2xl font-light text-white mt-3 tracking-wide">Opening Hours</h3>
            </div>
            <div className="bg-[#111] border border-stone-800 rounded-lg p-6">
              {Object.entries(merchant.operating_hours).map(([day, hours]) => {
                const isToday = day.toLowerCase() === todayKey;
                return (
                  <div
                    key={day}
                    className={`flex justify-between py-3 border-b border-stone-800/50 last:border-0 ${
                      isToday ? "bg-stone-900/50 -mx-6 px-6" : ""
                    }`}
                  >
                    <span
                      className={`text-sm capitalize tracking-wide ${
                        isToday ? "text-amber-500 font-semibold" : "text-stone-500"
                      }`}
                    >
                      {day} {isToday && "· Today"}
                    </span>
                    <span
                      className={`text-sm ${
                        isToday ? "text-amber-500 font-semibold" : "text-stone-300"
                      }`}
                    >
                      {hours}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Footer */}
      <footer className="bg-black border-t border-stone-900 py-10 md:py-12 text-center">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-stone-600 active:text-stone-400 active:scale-95 transition-all duration-200 select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Discover more restaurants
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
        <p className="mt-4 text-xs text-stone-800">
          Powered by BiteSite
        </p>
      </footer>
    </div>
  );
}
