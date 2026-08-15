"use client";

import { MapPin, Phone, MessageCircle, ArrowRight, Clock } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import type { LayoutProps } from "@/types";

export default function ModernLayout({
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
    <div className="min-h-screen bg-white text-gray-900">
      {/* Mobile Back Navigation */}
      <nav className="w-full px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-gray-100">
        <a
          href="/"
          className="text-sm text-gray-400 active:text-gray-900 active:scale-95 transition-all duration-150 flex items-center gap-1.5 select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back to BiteSite</span>
          <span className="sm:hidden">Back</span>
        </a>
      </nav>

      {/* Asymmetric Hero */}
      <FadeIn direction="up" duration={0.6}>
        <div className="grid md:grid-cols-2 min-h-[60vh] md:min-h-[70vh]">
          <div className="relative h-[40vh] md:h-auto">
            <SafeImage
              src={merchant.cover_image}
              alt={merchant.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center p-6 md:p-16 bg-gray-50">
            <span className="text-indigo-600 font-medium text-xs md:text-sm tracking-wider uppercase mb-4">
              {merchant.cuisine_type}
            </span>
            <h1 className="text-3xl md:text-6xl font-bold text-gray-900 mb-4 md:mb-6 leading-tight tracking-tight">
              {merchant.name}
            </h1>
            <p className="text-gray-600 text-base md:text-lg mb-6 md:mb-8 max-w-md leading-relaxed">
              {merchant.description}
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {merchant.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 active:text-indigo-600 active:scale-95 transition-all duration-150"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span className="leading-relaxed">{merchant.address}</span>
                </a>
              )}
              {merchant.phone && (
                <a
                  href={`tel:${merchant.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 active:text-indigo-600 active:scale-95 transition-all duration-150"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Phone className="w-4 h-4 text-indigo-600" />
                  <span>{merchant.phone}</span>
                </a>
              )}
            </div>
            {merchant.whatsapp && (
              <a
                href={`https://wa.me/${merchant.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 md:mt-8 w-fit px-6 py-3 bg-indigo-600 active:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 active:scale-[0.98] transition-all duration-150 select-none"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Menu - Magazine Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <FadeIn>
          <div className="flex items-end justify-between mb-8 md:mb-12">
            <div>
              <span className="text-indigo-600 text-xs md:text-sm font-medium uppercase tracking-wider">Menu</span>
              <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mt-2 tracking-tight">Our Selection</h2>
            </div>
          </div>
        </FadeIn>

        <div className="space-y-16 md:space-y-20">
          {categories.map((category, catIndex) => {
            const categoryProducts = getProductsByCategory(category.id);
            if (categoryProducts.length === 0) return null;

            return (
              <FadeIn key={category.id} delay={catIndex * 0.1}>
                <section>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-6 md:mb-8 flex items-center gap-3 tracking-wide">
                    <span className="w-6 md:w-8 h-[2px] bg-indigo-600" />
                    {category.name}
                  </h3>
                  <div className={`grid gap-4 md:gap-6 ${catIndex % 2 === 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    {categoryProducts.map((product, idx) => (
                      <FadeIn key={product.id} delay={idx * 0.05}>
                        <div className={`bg-white rounded-xl border border-gray-100 p-4 ${idx === 0 && catIndex % 2 === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}>
                          {product.image_url && (
                            <div className={`relative overflow-hidden rounded-lg mb-3 md:mb-4 ${idx === 0 && catIndex % 2 === 0 ? 'aspect-[4/3]' : 'aspect-square'}`}>
                              <SafeImage
                                src={product.image_url}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes={idx === 0 && catIndex % 2 === 0 ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 50vw, 33vw"}
                              />
                            </div>
                          )}
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-gray-900 text-sm md:text-base leading-snug tracking-wide">
                                {product.name}
                              </h4>
                              {product.description && (
                                <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                  {product.description}
                                </p>
                              )}
                              {product.is_available === false && (
                                <span className="inline-block mt-1 text-xs text-red-500 font-medium">
                                  Currently Unavailable
                                </span>
                              )}
                            </div>
                            {product.show_prices !== false && product.price > 0 && (
                              <span className="text-indigo-600 font-bold text-sm whitespace-nowrap ml-2 tracking-wide">
                                {product.discount_price ? (
                                  <>
                                    <span className="line-through text-gray-400 mr-1 text-xs">
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
          <div className="max-w-2xl mx-auto px-6 pb-16">
            <div className="text-center mb-8">
              <span className="text-indigo-600 text-xs font-medium uppercase tracking-wider">Hours</span>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-2 tracking-tight">Opening Hours</h3>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              {Object.entries(merchant.operating_hours).map(([day, hours]) => {
                const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const isToday = day.toLowerCase() === days[new Date().getDay()] || day.toLowerCase() === days[new Date().getDay()].slice(0, 3);
                return (
                  <div key={day} className={`flex justify-between py-3 border-b border-gray-200 last:border-0 ${isToday ? 'bg-white -mx-3 px-3 rounded shadow-sm' : ''}`}>
                    <span className={`text-sm capitalize tracking-wide ${isToday ? 'font-semibold text-indigo-600' : 'text-gray-500'}`}>{day}</span>
                    <span className={`text-sm ${isToday ? 'font-semibold text-indigo-600' : 'text-gray-900'}`}>{hours}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 md:py-12 text-center">
        <a
          href="/"
          className="inline-block active:text-white active:scale-95 transition-all duration-200 select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <p className="font-medium text-base">BiteSite</p>
          <p className="text-sm mt-1 text-gray-600">Discover more restaurants</p>
        </a>
      </footer>
    </div>
  );
}
