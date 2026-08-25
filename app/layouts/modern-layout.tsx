/* bitesite/app/layouts/modern-layout.tsx    */

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

export function ModernLayout({
  merchant, categories, products, videos, features, viewCount, events,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);
  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-600 text-sm font-medium active:scale-95 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="max-w-5xl mx-auto px-4 pt-8">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{merchant.cuisine_type}</span>
                  {typeof viewCount !== "undefined" && viewCount > 0 && (
                    <ViewCountInline count={viewCount} className="ml-0" />
                  )}
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4 leading-tight">{merchant.name}</h1>
                <p className="text-slate-600 leading-relaxed">{merchant.description}</p>
                {hours && (
                  <p className="mt-4 text-sm text-slate-500 flex items-center gap-2">
                    <Clock size={16} /> Today: {hours[today] || "Closed"}
                  </p>
                )}
              </div>
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {resolvedFeatures.menu && (
        <FadeIn>
          <section className="py-12 px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-8">Menu</h2>
              <div className="grid md:grid-cols-2 gap-8">
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-900">{cat.name}</h3>
                      <div className="space-y-4">
                        {catProducts.map((product) => (
                          <div key={product.id} className="group">
                            <div className="flex justify-between items-baseline gap-3">
                              <h4 className="font-semibold text-slate-800 group-hover:text-slate-600 transition-colors">{product.name}</h4>
                              <span className="font-bold text-slate-900 whitespace-nowrap">
                                {product.discount_price ? (
                                  <><span className="line-through opacity-40 text-sm mr-1">RM {product.price}</span>RM {product.discount_price}</>
                                ) : `RM ${product.price}`}
                              </span>
                            </div>
                            {product.description && <p className="text-sm text-slate-500 mt-1">{product.description}</p>}
                            {!product.is_available && <span className="text-xs text-red-500 mt-1 block">Currently Unavailable</span>}
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

      <TierSections merchant={merchant} products={products} features={features} variant="modern" events={events} />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-12 px-4 bg-slate-50">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Visit Us</h2>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-slate-600 hover:text-slate-900 transition-colors"><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span className="text-sm">{merchant.address}</span></a>}
                  {merchant.phone && <a href={`tel:${merchant.phone}`} className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors"><Phone size={18} /><span className="text-sm">{merchant.phone}</span></a>}
                  {merchant.whatsapp && <a href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-green-600 hover:text-green-700 transition-colors"><MessageSquare size={18} /><span className="text-sm font-medium">WhatsApp</span></a>}
                  {merchant.email && <a href={`mailto:${merchant.email}`} className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors"><Mail size={18} /><span className="text-sm">{merchant.email}</span></a>}
                </div>
                <div className="space-y-2">
                  {hours && Object.entries(hours).map(([day, time]) => (
                    <div key={day} className={`flex justify-between py-2 px-3 rounded-lg text-sm ${day === today ? "bg-white shadow-sm text-slate-900 font-medium" : "text-slate-500"}`}>
                      <span className="capitalize">{day}</span><span>{time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map */}
              <MapEmbed address={merchant.address} borderColor="#E2E8F0" />

              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
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
              <div className="mt-8 pt-6 border-t border-slate-200">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                  Share
                </p>
                <ShareButtons slug={merchant.slug} name={merchant.name} variant="modern" />
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <footer className="py-8 px-4 text-center border-t border-slate-100">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">Discover more restaurants on BiteSite</Link>
      </footer>
    </div>
  );
}
