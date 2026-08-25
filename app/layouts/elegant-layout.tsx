/* bitesite/app/layouts/elegant-layout.tsx    */

"use client";

import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { ViewCountInline } from "@/components/sections/view-count-inline";
import { ShareButtons } from "@/components/sections/share-buttons";
import { mergeFeatures } from "@/types";
import type { LayoutProps } from "@/types";
import {
  MapPin, Phone, Mail, Instagram, ArrowLeft, MessageSquare, Banknote, Smartphone, CreditCard,
} from "lucide-react";
import Link from "next/link";
import { getTodayKey } from "@/lib/hours";
import { MapEmbed } from "@/app/components/map-embed";

export function ElegantLayout({
  merchant, categories, products, videos, features, viewCount, events,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);

  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;

  const navItems = [
    { label: "Menu", id: "menu-section", show: resolvedFeatures.menu },
    { label: "Hours", id: "hours-section", show: resolvedFeatures.contact },
    { label: "Gallery", id: "gallery-section", show: resolvedFeatures.gallery },
    { label: "Reserve", id: "reserve-section", show: resolvedFeatures.appointment },
    { label: "Reviews", id: "reviews-section", show: resolvedFeatures.reviews },
    { label: "Events", id: "events-section", show: resolvedFeatures.events },
  ].filter((item) => item.show);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Back Nav */}
      <div className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium active:scale-95 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {/* Scroll Nav */}
      {navItems.length > 0 && (
        <div className="sticky top-[53px] z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="px-4 py-3 text-sm font-medium text-slate-400 hover:text-amber-400 transition-colors whitespace-nowrap active:scale-95"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hero */}
      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="relative h-72 sm:h-96">
            {merchant.cover_image ? (
              <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
            ) : (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                <span className="text-slate-600 text-sm">No Image</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                    {merchant.cuisine_type}
                  </span>
                  {typeof viewCount !== "undefined" && viewCount > 0 && (
                    <ViewCountInline count={viewCount} className="ml-0" />
                  )}
                </div>
                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2">{merchant.name}</h1>
                <p className="text-slate-400 text-sm sm:text-base max-w-xl">{merchant.description}</p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Menu */}
      {resolvedFeatures.menu && (
        <FadeIn>
          <section id="menu-section" className="py-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto space-y-10">
              {categories.map((cat) => {
                const catProducts = products.filter((p) => p.category_id === cat.id);
                if (catProducts.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h3 className="text-lg font-semibold text-amber-100 mb-4 pb-2 border-b border-slate-800">{cat.name}</h3>
                    <div className="space-y-4">
                      {catProducts.map((product) => (
                        <div key={product.id} className="flex gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
                          {product.image_url ? (
                            <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                              <SafeImage src={product.image_url} alt={product.name} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-600">
                              No Image
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="font-semibold text-slate-200">{product.name}</h4>
                              <span className="font-bold text-amber-400 whitespace-nowrap">
                                {product.discount_price ? (
                                  <><span className="line-through opacity-50 text-sm mr-1">RM {product.price}</span>RM {product.discount_price}</>
                                ) : (
                                  `RM ${product.price}`
                                )}
                              </span>
                            </div>
                            {product.description && (
                              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                            )}
                            {!product.is_available && (
                              <span className="inline-block mt-1 text-xs font-medium text-red-400 bg-red-950/50 px-2 py-0.5 rounded">Currently Unavailable</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </FadeIn>
      )}

      <TierSections merchant={merchant} products={products} features={features} variant="elegant" events={events} />

      {/* Hours & Contact */}
      {resolvedFeatures.contact && (
        <FadeIn>
          <section id="hours-section" className="py-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-amber-100 mb-6">Opening Hours</h2>
              <div className="space-y-2">
                {hours && Object.entries(hours).map(([day, time]) => {
                  const isToday = day === today;
                  const timeSlots = time.split(",").map((t) => t.trim());
                  return (
                    <div
                      key={day}
                      className={`flex justify-between py-3 px-4 rounded-lg ${
                        isToday ? "bg-slate-800 text-amber-300 font-medium" : "text-slate-400"
                      }`}
                    >
                      <span className="capitalize flex-shrink-0">{day}</span>
                      <div className="text-right">
                        {timeSlots.map((slot, i) => (
                          <div key={i}>{slot}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 space-y-4">
                {merchant.address && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-slate-400 hover:text-slate-200 transition-colors">
                    <MapPin size={18} className="mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{merchant.address}</span>
                  </a>
                )}
                {merchant.phone && (
                  <a href={`tel:${merchant.phone}`} className="flex items-center gap-3 text-slate-400 hover:text-slate-200 transition-colors">
                    <Phone size={18} /><span className="text-sm">{merchant.phone}</span>
                  </a>
                )}
                {merchant.whatsapp && (
                  <a href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-green-400 hover:text-green-300 transition-colors">
                    <MessageSquare size={18} /><span className="text-sm font-medium">WhatsApp</span>
                  </a>
                )}
              </div>

              {/* Map */}
              <MapEmbed address={merchant.address} borderColor="#334155" />

              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
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
              <div className="mt-8 pt-6 border-t border-slate-800">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">
                  Share
                </p>
                <ShareButtons slug={merchant.slug} name={merchant.name} variant="elegant" />
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <footer className="py-8 px-4 text-center border-t border-slate-800">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Discover more restaurants on BiteSite</Link>
      </footer>
    </div>
  );
}
