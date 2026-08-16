/* bitesite/app/layouts/minimal-layout.tsx    */

"use client";

import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { mergeFeatures } from "@/types";
import type { LayoutProps } from "@/types";
import { MapPin, Phone, Instagram, ArrowLeft, MessageSquare, Banknote, Smartphone, CreditCard } from "lucide-react";
import Link from "next/link";

export function MinimalLayout({
  merchant, categories, products, videos, features,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);
  const today = new Date().toLocaleDateString("en-MY", { weekday: "long" }).toLowerCase();
  const hours = merchant.operating_hours as Record<string, string> | null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="sticky top-0 z-40 bg-stone-50/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-stone-600 text-sm active:scale-95 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="max-w-3xl mx-auto px-4 pt-8 pb-6">
            {merchant.cover_image && (
              <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-6">
                <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
              </div>
            )}
            <span className="text-xs font-medium tracking-widest uppercase text-stone-500">{merchant.cuisine_type}</span>
            <h1 className="text-3xl font-light mt-2 mb-4">{merchant.name}</h1>
            <p className="text-stone-600 leading-relaxed text-sm">{merchant.description}</p>
          </div>
        </FadeIn>
      )}

      {resolvedFeatures.menu && (
        <FadeIn>
          <section className="py-8 px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-sm font-medium tracking-widest uppercase text-stone-500 mb-6">Menu</h2>
              <div className="space-y-8">
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <h3 className="text-sm font-semibold text-stone-800 mb-4 border-b border-stone-200 pb-2">{cat.name}</h3>
                      <div className="space-y-4">
                        {catProducts.map((product) => (
                          <div key={product.id} className="flex justify-between items-baseline gap-4 py-2">
                            <div className="flex-1">
                              <span className="text-stone-800">{product.name}</span>
                              {product.description && <p className="text-xs text-stone-500 mt-0.5">{product.description}</p>}
                              {!product.is_available && <span className="text-xs text-red-500 mt-0.5 block">Unavailable</span>}
                            </div>
                            <span className="text-sm font-medium text-stone-600 whitespace-nowrap">
                              {product.discount_price ? (
                                <><span className="line-through opacity-50 text-xs mr-1">RM {product.price}</span>RM {product.discount_price}</>
                              ) : `RM ${product.price}`}
                            </span>
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

      <TierSections merchant={merchant} products={products} features={features} variant="minimal" />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-8 px-4 border-t border-stone-200">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-sm font-medium tracking-widest uppercase text-stone-500 mb-6">Info</h2>
              <div className="space-y-3 text-sm">
                {hours && Object.entries(hours).map(([day, time]) => (
                  <div key={day} className={`flex justify-between py-1 ${day === today ? "text-stone-900 font-medium" : "text-stone-500"}`}>
                    <span className="capitalize">{day}</span><span>{time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3 text-sm">
                {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-stone-600"><MapPin size={16} />{merchant.address}</a>}
                {merchant.phone && <a href={`tel:${merchant.phone}`} className="flex items-center gap-2 text-stone-600"><Phone size={16} />{merchant.phone}</a>}
                {merchant.whatsapp && <a href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600"><MessageSquare size={16} />WhatsApp</a>}
              </div>

              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-6 pt-6 border-t border-stone-200">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-500 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
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

      <footer className="py-6 px-4 text-center border-t border-stone-200">
        <Link href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Discover more on BiteSite</Link>
      </footer>
    </div>
  );
}
