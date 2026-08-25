/* bitesite/app/layouts/rustic-layout.tsx    */

"use client";

import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { ViewCountInline } from "@/components/sections/view-count-inline";
import { ShareButtons } from "@/components/sections/share-buttons";
import { mergeFeatures } from "@/types";
import type { LayoutProps } from "@/types";
import { MapPin, Phone, Mail, Instagram, ArrowLeft, MessageSquare, Clock, Banknote, Smartphone, CreditCard } from "lucide-react";
import Link from "next/link";
import { getTodayKey } from "@/lib/hours";
import { MapEmbed } from "@/app/components/map-embed";

export function RusticLayout({
  merchant, categories, products, videos, features, viewCount, events,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);
  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;

  return (
    <div className="min-h-screen bg-orange-50 text-orange-950">
      <div className="sticky top-0 z-40 bg-orange-50/80 backdrop-blur-md border-b border-orange-200/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-orange-800 text-sm font-medium active:scale-95 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="relative">
            <div className="h-64 sm:h-80">
              <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-orange-950/70 to-transparent" />
            </div>
            <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10">
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-orange-100">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="inline-block px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold">{merchant.cuisine_type}</span>
                  {typeof viewCount !== "undefined" && viewCount > 0 && (
                    <ViewCountInline count={viewCount} className="ml-0" />
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-orange-900 mb-3">{merchant.name}</h1>
                <p className="text-orange-800/70 leading-relaxed">{merchant.description}</p>
                {hours && <p className="mt-3 text-sm text-orange-700 font-medium flex items-center gap-2"><Clock size={16} /> Today: {hours[today] || "Closed"}</p>}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {resolvedFeatures.menu && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-orange-900 mb-6 text-center">Our Menu</h2>
              <div className="space-y-8">
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id} className="bg-white rounded-2xl p-6 border border-orange-100">
                      <h3 className="text-lg font-bold text-orange-800 mb-4 text-center">{cat.name}</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {catProducts.map((product) => (
                          <div key={product.id} className="flex gap-3 p-3 rounded-xl hover:bg-orange-50/50 transition-colors">
                            {product.image_url && (
                              <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                                <SafeImage src={product.image_url} alt={product.name} fill className="object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-semibold text-orange-900 text-sm">{product.name}</h4>
                                <span className="font-bold text-orange-700 text-sm whitespace-nowrap">
                                  {product.discount_price ? (
                                    <><span className="line-through opacity-50 text-xs mr-1">RM {product.price}</span>RM {product.discount_price}</>
                                  ) : `RM ${product.price}`}
                                </span>
                              </div>
                              {product.description && <p className="text-xs text-orange-800/60 mt-1 line-clamp-2">{product.description}</p>}
                              {!product.is_available && <span className="inline-block mt-1 text-xs text-red-500">Unavailable</span>}
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

      <TierSections merchant={merchant} products={products} features={features} variant="rustic" events={events} />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6 bg-white">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-orange-900 mb-6 text-center">Find Us</h2>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-orange-800 active:scale-[0.98] transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span className="text-sm">{merchant.address}</span></a>}
                  {merchant.phone && <a href={`tel:${merchant.phone}`} className="flex items-center gap-3 text-orange-800 active:scale-[0.98] transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}><Phone size={18} /><span className="text-sm">{merchant.phone}</span></a>}
                  {merchant.whatsapp && <a href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-green-700 active:scale-[0.98] transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}><MessageSquare size={18} /><span className="text-sm font-medium">WhatsApp</span></a>}
                  {merchant.email && <a href={`mailto:${merchant.email}`} className="flex items-center gap-3 text-orange-800 active:scale-[0.98] transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}><Mail size={18} /><span className="text-sm">{merchant.email}</span></a>}
                </div>
                <div className="space-y-2">
                  {hours && Object.entries(hours).map(([day, time]) => (
                    <div key={day} className={`flex justify-between py-2 px-3 rounded-lg text-sm ${day === today ? "bg-orange-100 text-orange-900 font-medium" : "text-orange-800/60"}`}>
                      <span className="capitalize">{day}</span><span>{time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map */}
              <MapEmbed address={merchant.address} borderColor="#FED7AA" />

              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-orange-200">
                  <p className="text-xs font-medium uppercase tracking-wider text-orange-800 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                        {method === "Cash" && <Banknote className="h-3 w-3" />}
                        {method === "Cashless" && <Smartphone className="h-3 w-3" />}
                        {method === "Cards" && <CreditCard className="h-3 w-3" />}
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Share */}
              <div className="mt-8 pt-6 border-t border-orange-200">
                <p className="text-xs font-medium uppercase tracking-wider text-orange-800 mb-3">
                  Share
                </p>
                <ShareButtons slug={merchant.slug} name={merchant.name} variant="rustic" />
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <footer className="py-8 px-4 text-center border-t border-orange-200">
        <Link href="/" className="text-sm text-orange-700 hover:text-orange-900 transition-colors">Discover more restaurants on BiteSite</Link>
      </footer>
    </div>
  );
}
