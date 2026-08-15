"use client";

import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { mergeFeatures } from "@/types";
import type { LayoutProps } from "@/types";
import {
  MapPin, Phone, Mail, Instagram, ArrowLeft,
  MessageSquare, Clock
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ElegantLayout({
  merchant, categories, products, videos, features,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);
  const [activeTab, setActiveTab] = useState<"menu" | "hours">("menu");

  const today = new Date().toLocaleDateString("en-MY", { weekday: "long" }).toLowerCase();
  const hours = merchant.operating_hours as Record<string, string> | null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium active:scale-95 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

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
                <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold mb-3 border border-amber-500/30">
                  {merchant.cuisine_type}
                </span>
                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2">{merchant.name}</h1>
                <p className="text-slate-400 text-sm sm:text-base max-w-xl">{merchant.description}</p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="sticky top-[53px] z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 flex gap-6">
          {(["menu", "hours"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {resolvedFeatures.menu && activeTab === "menu" && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6">
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

      {resolvedFeatures.contact && activeTab === "hours" && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-amber-100 mb-6">Opening Hours</h2>
              <div className="space-y-2">
                {hours && Object.entries(hours).map(([day, time]) => (
                  <div key={day} className={`flex justify-between py-3 px-4 rounded-lg ${day === today ? "bg-slate-800 text-amber-300 font-medium" : "text-slate-400"}`}>
                    <span className="capitalize">{day}</span>
                    <span>{time}</span>
                  </div>
                ))}
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
            </div>
          </section>
        </FadeIn>
      )}

      <TierSections merchant={merchant} products={products} features={features} variant="elegant" />

      <footer className="py-8 px-4 text-center border-t border-slate-800">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Discover more restaurants on BiteSite</Link>
      </footer>
    </div>
  );
}
