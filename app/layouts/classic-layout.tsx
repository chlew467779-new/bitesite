"use client";

import { MapPin, Phone, Clock, MessageCircle } from "lucide-react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import type { LayoutProps } from "@/types";

function getTodayHours(operatingHours: Record<string, string> | null): { day: string; hours: string } | null {
  if (!operatingHours) return null;
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayIndex = new Date().getDay();
  const todayLower = days[todayIndex];
  const todayCapitalized = todayLower.charAt(0).toUpperCase() + todayLower.slice(1);
  const hours = operatingHours[todayLower] || operatingHours[todayCapitalized] || operatingHours[todayLower.slice(0, 3)] || operatingHours[todayCapitalized.slice(0, 3)];
  return hours ? { day: todayCapitalized, hours } : null;
}

export default function ClassicLayout({
  merchant,
  categories,
  products,
  videos,
  features,
}: LayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  const todayInfo = getTodayHours(merchant.operating_hours);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-800">
      {/* Mobile Back Navigation */}
      <nav className="w-full px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-[#faf8f5]/90 border-b border-stone-200/50">
        <a
          href="/"
          className="text-sm text-stone-500 active:text-stone-800 active:scale-95 transition-all duration-150 flex items-center gap-1.5 select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back to BiteSite</span>
          <span className="sm:hidden">Back</span>
        </a>
      </nav>

      {/* Hero */}
      <FadeIn direction="up" duration={0.6}>
        <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden">
          <SafeImage
            src={merchant.cover_image}
            alt={merchant.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="max-w-4xl mx-auto">
              <span className="inline-block px-3 py-1 bg-amber-500/90 text-white text-xs font-medium rounded-full mb-3 tracking-wide">
                {merchant.cuisine_type}
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 leading-tight">
                {merchant.name}
              </h1>
              <p className="text-white/80 text-base md:text-lg max-w-xl leading-relaxed">
                {merchant.description}
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Info Bar */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap gap-4 text-sm text-stone-600">
          {merchant.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 active:scale-95 transition-transform duration-150"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <MapPin className="w-4 h-4 text-amber-600" />
              <span className="leading-relaxed">{merchant.address}</span>
            </a>
          )}
          {merchant.phone && (
            <a
              href={`tel:${merchant.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 active:scale-95 transition-transform duration-150"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Phone className="w-4 h-4 text-amber-600" />
              <span>{merchant.phone}</span>
            </a>
          )}
          {todayInfo ? (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="leading-relaxed">
                <span className="font-medium text-stone-800">{todayInfo.day}:</span> {todayInfo.hours}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="leading-relaxed">Open Today</span>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp CTA */}
      {merchant.whatsapp && (
        <FadeIn delay={0.1}>
          <div className="max-w-4xl mx-auto px-6 py-6">
            <a
              href={`https://wa.me/${merchant.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto px-8 py-3 bg-green-600 active:bg-green-700 text-white rounded-full font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-150 select-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <MessageCircle className="w-5 h-5" />
              Message on WhatsApp
            </a>
          </div>
        </FadeIn>
      )}

      {/* Menu Sections */}
      <div className="max-w-4xl mx-auto px-6 pb-16 space-y-12">
        {categories.map((category, catIndex) => {
          const categoryProducts = getProductsByCategory(category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <FadeIn key={category.id} delay={catIndex * 0.1}>
              <section>
                <h2 className="text-xl font-semibold text-stone-800 mb-6 pb-2 border-b border-stone-200 tracking-wide">
                  {category.name}
                </h2>
                <div className="grid gap-4">
                  {categoryProducts.map((product, prodIndex) => (
                    <FadeIn key={product.id} delay={prodIndex * 0.05} direction="up">
                      <div className="flex gap-4 p-4 bg-white rounded-xl border border-stone-100">
                        {product.image_url && (
                          <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                            <SafeImage
                              src={product.image_url}
                              alt={product.name}
                              width={96}
                              height={96}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-stone-800 text-base leading-snug tracking-wide">
                              {product.name}
                            </h3>
                            {product.show_prices !== false && product.price > 0 && (
                              <span className="text-amber-700 font-semibold text-sm whitespace-nowrap tracking-wide">
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
                            <p className="text-sm text-stone-500 mt-1 leading-relaxed line-clamp-2">
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
            <h3 className="text-center text-lg font-semibold text-stone-800 mb-6 tracking-wide">
              Opening Hours
            </h3>
            <div className="bg-white rounded-xl p-6 border border-stone-100">
              {Object.entries(merchant.operating_hours).map(([day, hours]) => {
                const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const isToday = day.toLowerCase() === days[new Date().getDay()] || day.toLowerCase() === days[new Date().getDay()].slice(0, 3);
                return (
                  <div key={day} className={`flex justify-between py-2.5 border-b border-stone-100 last:border-0 ${isToday ? 'bg-amber-50 -mx-2 px-2 rounded' : ''}`}>
                    <span className={`text-sm capitalize leading-relaxed ${isToday ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>{day}</span>
                    <span className={`text-sm ${isToday ? 'font-semibold text-amber-700' : 'text-stone-700'}`}>{hours}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
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
