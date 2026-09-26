/* bitesite/app/layouts/malay-layout.tsx */

"use client";

import type { ReactNode } from "react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { ShareButtons } from "@/components/sections/share-buttons";
import { mergeFeatures } from "@/types";
import type { LayoutProps } from "@/types";
import { MapPin, Phone, Mail, Instagram, Globe, ArrowLeft, MessageSquare, Clock, Banknote, Smartphone, CreditCard } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { MenuViewTracker } from "@/components/sections/menu-view-tracker";
import { shouldShowPrice } from "@/lib/menu-display.mjs";
import Link from "next/link";
import { getTodayKey, formatOperatingHours, DAYS } from "@/lib/hours";
import { MapEmbed } from "@/app/components/map-embed";

/**
 * Malay layout — emerald and songket gold on off-white, with a woven lattice band, an overlapping
 * name card and category cards with emerald headers.
 *
 * Registered with productionReady: false (lib/layout-registry.mjs), so it only renders on
 * internal surfaces such as /dev/layout-fixtures until it is visually signed off. Shared sections
 * take their colours from the `malay` theme in lib/layout-theme.mjs.
 */

const focusRing =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";

// Gold lattice drawn with gradients only: no image request, nothing for a CSP to block.
const songketPattern = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.85) 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, rgba(245, 158, 11, 0.85) 0 2px, transparent 2px 10px)",
};

function SongketBand({ className = "h-3" }: { className?: string }) {
  return <div aria-hidden="true" className={`bg-emerald-800 ${className}`} style={songketPattern} />;
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-emerald-900 break-words">{children}</h2>
      <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-1.5">
        <span className="h-1.5 w-1.5 rotate-45 bg-amber-500" />
        <span className="h-2.5 w-2.5 rotate-45 bg-emerald-800" />
        <span className="h-1.5 w-1.5 rotate-45 bg-amber-500" />
      </div>
    </div>
  );
}

export function MalayLayout({
  merchant, categories, products, features, events, footerText,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);
  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;
  const hasHours = Boolean(hours && Object.values(hours).some((value) => value?.trim()));
  const showAbout = resolvedFeatures.about && Boolean(merchant.description);

  return (
    <div className="min-h-screen bg-[#F8F6EF] text-stone-900">
      <div className="sticky top-0 z-40 bg-[#F8F6EF]/90 backdrop-blur-md border-b border-emerald-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/" className={`inline-flex items-center gap-2 text-emerald-900 text-sm font-medium active:scale-95 transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="relative">
            <div className="relative h-56 sm:h-80 bg-emerald-800">
              {merchant.cover_image ? (
                <div className="absolute inset-0">
                  <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/70 to-transparent" />
                </div>
              ) : (
                <div aria-hidden="true" className="absolute inset-0 opacity-25" style={songketPattern} />
              )}
            </div>
            <SongketBand />
            <div className="max-w-4xl mx-auto px-4 -mt-16 sm:-mt-20 relative z-10">
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-emerald-100 border-t-4 border-t-amber-500">
                {merchant.cuisine_type && <span className="inline-block mb-3 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">{merchant.cuisine_type}</span>}
                <h1 className="text-3xl sm:text-4xl font-bold text-emerald-950 break-words">{merchant.name}</h1>
                {showAbout && <p className="mt-3 text-stone-700 leading-relaxed break-words">{merchant.description}</p>}
                {hasHours && <p className="mt-3 text-sm text-emerald-800 font-medium flex items-center gap-2"><Clock size={16} /> Today: {formatOperatingHours(hours?.[today]) || "Closed"}</p>}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {!resolvedFeatures.hero && showAbout && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6">
            <p className="max-w-2xl mx-auto text-center text-stone-700 text-base sm:text-lg leading-relaxed break-words">
              {merchant.description}
            </p>
          </section>
        </FadeIn>
      )}

      {resolvedFeatures.menu && products.length > 0 && (
        <FadeIn>
          <MenuViewTracker slug={merchant.slug} />
          <section id="menu-section" className="py-12 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <SectionHeading>Menu</SectionHeading>
              <div className="grid gap-6 md:grid-cols-2 items-start">
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id} className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
                      <h3 className="bg-emerald-800 px-5 py-3 text-lg font-bold text-amber-50 break-words">{cat.name}</h3>
                      <SongketBand className="h-1.5" />
                      <ul className="divide-y divide-emerald-50 px-5">
                        {catProducts.map((product) => (
                          <li key={product.id} className="flex gap-3 py-4">
                            {product.image_url && (
                              <div className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-amber-400/60">
                                <SafeImage src={product.image_url} alt={product.name} fill className="object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-semibold text-stone-900 break-words min-w-0">{product.name}</h4>
                                {shouldShowPrice(product) && (
                                  <span className="font-bold text-emerald-800 whitespace-nowrap">
                                    {product.discount_price ? (
                                      <><span className="line-through text-stone-500 text-sm font-normal mr-1">RM {product.price}</span>RM {product.discount_price}</>
                                    ) : `RM ${product.price}`}
                                  </span>
                                )}
                              </div>
                              {product.description && <p className="text-sm text-stone-600 mt-1 line-clamp-2 break-words">{product.description}</p>}
                              {!product.is_available && (
                                <span className="inline-block mt-1.5 text-xs font-medium text-stone-700 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded">
                                  Currently Unavailable
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <TierSections merchant={merchant} products={products} features={features} variant="malay" events={events} />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-12 px-4 sm:px-6 bg-white">
            <div className="max-w-4xl mx-auto">
              <SectionHeading>Find Us</SectionHeading>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} onClick={() => trackEvent('directions_click', { slug: merchant.slug, pageType: 'merchant' })} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span className="text-sm break-words min-w-0">{merchant.address}</span></a>}
                  {merchant.phone && <a href={`tel:${merchant.phone}`} onClick={() => trackEvent('phone_click', { slug: merchant.slug, pageType: 'merchant' })} className={`flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Phone size={18} /><span className="text-sm">{merchant.phone}</span></a>}
                  {merchant.website && <a href={merchant.website} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('website_click', { slug: merchant.slug, pageType: 'merchant' })} className={`flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Globe size={18} /><span className="text-sm">Website</span></a>}
                  {merchant.whatsapp && (
                    <a
                      href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent('whatsapp_click', { slug: merchant.slug, pageType: 'merchant' })}
                      className={`flex items-center gap-3 text-green-800 active:scale-[0.98] transition-transform ${focusRing}`}
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <MessageSquare size={18} /><span className="text-sm font-medium">WhatsApp</span>
                    </a>
                  )}
                  {merchant.email && <a href={`mailto:${merchant.email}`} onClick={() => trackEvent('email_click', { slug: merchant.slug, pageType: 'merchant' })} className={`flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Mail size={18} /><span className="text-sm break-all">{merchant.email}</span></a>}
                  {merchant.instagram && <a href={merchant.instagram} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Instagram size={18} /><span className="text-sm">Instagram</span></a>}
                </div>
                <div className="space-y-1.5">
                  {hasHours && DAYS.map((day) => {
                    const time = hours?.[day];
                    if (!time) return null;
                    return (
                      <div key={day} className={`flex justify-between gap-3 py-2 px-3 rounded-lg text-sm ${day === today ? "bg-emerald-800 text-amber-50 font-medium" : "text-stone-700"}`}>
                        <span className="capitalize">{day}</span><span>{formatOperatingHours(time)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Map */}
              <MapEmbed address={merchant.address} borderColor="#A7F3D0" />

              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-emerald-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-900 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200">
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
              <div className="mt-8 pt-6 border-t border-emerald-100">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-900 mb-3">
                  Share
                </p>
                <ShareButtons slug={merchant.slug} name={merchant.name} variant="malay" />
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <footer className="bg-emerald-900 text-center">
        <SongketBand />
        <div className="py-8 px-4">
          <Link href="/" className={`text-sm text-amber-50 hover:text-white transition-colors ${focusRing} focus-visible:ring-offset-emerald-900`}>{footerText || "Discover more restaurants on BiteSite"}</Link>
        </div>
      </footer>
    </div>
  );
}
