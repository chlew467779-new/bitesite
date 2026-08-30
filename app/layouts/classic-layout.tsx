/* bitesite/app/layouts/classic-layout.tsx    */

"use client";

import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { MapPin, Phone, Clock, Mail, Instagram, ArrowLeft, MessageSquare, Banknote, Smartphone, CreditCard } from "lucide-react";
import Link from "next/link";
import type { LayoutProps } from "@/types";
import { mergeFeatures } from "@/types";
import { getTodayKey } from "@/lib/hours";
import { MapEmbed } from "@/app/components/map-embed";
import { trackEvent } from "@/lib/analytics";

export function ClassicLayout({
  merchant,
  categories,
  products,
  videos,
  features,
  events,
  footerText,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);

  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;
  const todayHours = hours?.[today] || "Closed";

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Sticky Back Nav */}
      <div className="sticky top-0 z-40 bg-amber-50/80 backdrop-blur-md border-b border-amber-200/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-800 text-sm font-medium active:scale-95 transition-transform"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <ArrowLeft size={18} />
            Back to BiteSite
          </Link>
        </div>
      </div>

      {/* Hero */}
      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="relative h-64 sm:h-80 lg:h-96">
            <SafeImage
              src={merchant.cover_image}
              alt={merchant.name}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <div className="max-w-4xl mx-auto">
                <span className="inline-block px-3 py-1 rounded-full bg-amber-100/90 text-amber-800 text-xs font-semibold mb-3">
                  {merchant.cuisine_type}
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">
                  {merchant.name}
                </h1>
                <p className="text-white/80 text-sm sm:text-base max-w-xl">
                  Today: {todayHours}
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* About */}
      {resolvedFeatures.about && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <p className="text-amber-900/80 text-base sm:text-lg leading-relaxed">
                {merchant.description}
              </p>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Menu */}
      {resolvedFeatures.menu && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-amber-900 mb-6">Menu</h2>
              <div className="space-y-8">
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <h3 className="text-lg font-semibold text-amber-800 mb-4 pb-2 border-b border-amber-200">
                        {cat.name}
                      </h3>
                      <div className="space-y-4">
                        {catProducts.map((product) => (
                          <div
                            key={product.id}
                            className="flex gap-4 p-4 bg-white rounded-xl border border-amber-100"
                          >
                            {product.image_url && (
                              <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                                <SafeImage
                                  src={product.image_url}
                                  alt={product.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-semibold text-amber-900">{product.name}</h4>
                                <span className="font-bold text-amber-700 whitespace-nowrap">
                                  {product.discount_price ? (
                                    <>
                                      <span className="line-through opacity-50 text-sm mr-1">
                                        RM {product.price}
                                      </span>
                                      RM {product.discount_price}
                                    </>
                                  ) : (
                                    `RM ${product.price}`
                                  )}
                                </span>
                              </div>
                              {product.description && (
                                <p className="text-sm text-amber-800/60 mt-1 line-clamp-2">
                                  {product.description}
                                </p>
                              )}
                              {!product.is_available && (
                                <span className="inline-block mt-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded">
                                  Currently Unavailable
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      {/* ── TIER SECTIONS ── */}
      <TierSections
        merchant={merchant}
        products={products}
        features={features}
        variant="classic"
        events={events}
      />

      {/* Contact / Hours */}
      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6 bg-white">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-amber-900 mb-6">Opening Hours</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {hours && Object.entries(hours).map(([day, time]) => (
                    <div
                      key={day}
                      className={`flex justify-between py-2 px-3 rounded-lg text-sm ${
                        day === today
                          ? "bg-amber-100 text-amber-900 font-medium"
                          : "text-amber-800/70"
                      }`}
                    >
                      <span className="capitalize">{day}</span>
                      <span>{time}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {merchant.address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 text-amber-800 active:scale-[0.98] transition-transform"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <MapPin size={18} className="mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{merchant.address}</span>
                    </a>
                  )}
                  {merchant.phone && (
                    <a
                      href={`tel:${merchant.phone}`}
                      className="flex items-center gap-3 text-amber-800 active:scale-[0.98] transition-transform"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <Phone size={18} />
                      <span className="text-sm">{merchant.phone}</span>
                    </a>
                  )}
                  {merchant.whatsapp && (
                    <a
                      href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent('whatsapp_click', { slug: merchant.slug, pageType: 'merchant' })}
                      className="flex items-center gap-3 text-green-700 active:scale-[0.98] transition-transform"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <MessageSquare size={18} />
                      <span className="text-sm font-medium">WhatsApp</span>
                    </a>
                  )}
                  {merchant.email && (
                    <a
                      href={`mailto:${merchant.email}`}
                      className="flex items-center gap-3 text-amber-800 active:scale-[0.98] transition-transform"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <Mail size={18} />
                      <span className="text-sm">{merchant.email}</span>
                    </a>
                  )}
                  {merchant.instagram && (
                    <a
                      href={merchant.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-amber-800 active:scale-[0.98] transition-transform"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <Instagram size={18} />
                      <span className="text-sm">Instagram</span>
                    </a>
                  )}
                </div>
              </div>
              
              {/* Map */}
              <MapEmbed address={merchant.address} borderColor="#FCD34D" />
  
              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-amber-200">
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-800 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        {method === "Cash" && <Banknote className="h-3 w-3" />}
                        {method === "Cashless" && <Smartphone className="h-3 w-3" />}
                        {method === "Cards" && <CreditCard className="h-3 w-3" />}
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </FadeIn>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 text-center border-t border-amber-200">
        <Link
          href="/"
          className="text-sm text-amber-700 hover:text-amber-900 transition-colors"
        >
          {footerText || "Discover more restaurants on BiteSite"}
        </Link>
      </footer>
    </div>
  );
}
