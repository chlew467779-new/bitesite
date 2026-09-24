/* bitesite/app/layouts/chinese-layout.tsx */

"use client";

import type { ReactNode } from "react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { ViewCountInline } from "@/components/sections/view-count-inline";
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
 * Chinese layout — red and gold on warm cream, with a seal mark, gold rules and a menu-board
 * list with dotted leaders.
 *
 * Registered with productionReady: false (lib/layout-registry.mjs), so it only renders on
 * internal surfaces such as /dev/layout-fixtures until it is visually signed off. Shared sections
 * take their colours from the `chinese` theme in lib/layout-theme.mjs.
 */

const focusRing =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      <span aria-hidden="true" className="h-px w-6 sm:w-14 bg-amber-500" />
      <span aria-hidden="true" className="h-2 w-2 rotate-45 bg-amber-500 flex-shrink-0" />
      <h2 className="text-2xl font-bold text-red-900 text-center break-words min-w-0">{children}</h2>
      <span aria-hidden="true" className="h-2 w-2 rotate-45 bg-amber-500 flex-shrink-0" />
      <span aria-hidden="true" className="h-px w-6 sm:w-14 bg-amber-500" />
    </div>
  );
}

export function ChineseLayout({
  merchant, categories, products, features, viewCount, events, footerText,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);
  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;
  const hasHours = Boolean(hours && Object.values(hours).some((value) => value?.trim()));
  // First character, not first UTF-16 unit, so CJK and emoji names get a whole glyph.
  const seal = (Array.from(merchant.name.trim())[0] ?? "").toUpperCase();

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-stone-900">
      <div className="sticky top-0 z-40 bg-[#FDF6EC]/90 backdrop-blur-md border-b border-amber-400/60">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/" className={`inline-flex items-center gap-2 text-red-900 text-sm font-medium active:scale-95 transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="relative min-h-72 sm:min-h-96 flex items-end bg-red-800">
            {merchant.cover_image ? (
              <div className="absolute inset-0">
                <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-red-950/90 via-red-950/40 to-transparent" />
              </div>
            ) : (
              <div aria-hidden="true" className="absolute inset-3 sm:inset-5 border border-amber-300/50 rounded-sm" />
            )}
            <div className="relative w-full max-w-4xl mx-auto px-6 sm:px-8 pt-16 pb-8 sm:pb-10">
              <div className="flex items-start gap-3 sm:gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center rounded-md border-2 border-amber-300 bg-red-800 text-xl sm:text-3xl font-bold text-amber-100 shadow-lg"
                >
                  {seal}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {merchant.cuisine_type && <span className="inline-block px-3 py-1 rounded-full bg-amber-300 text-red-950 text-xs font-semibold">{merchant.cuisine_type}</span>}
                    {typeof viewCount !== "undefined" && viewCount > 0 && (
                      <ViewCountInline count={viewCount} className="ml-0" />
                    )}
                  </div>
                  <h1 className="text-[1.625rem] leading-tight sm:text-4xl lg:text-5xl font-bold text-white break-words">{merchant.name}</h1>
                  {hasHours && <p className="mt-2 text-sm sm:text-base text-amber-100 flex items-center gap-2"><Clock size={16} /> Today: {formatOperatingHours(hours?.[today]) || "Closed"}</p>}
                </div>
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
        </FadeIn>
      )}

      {resolvedFeatures.about && merchant.description && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6">
            <p className="max-w-2xl mx-auto text-center text-stone-800 text-base sm:text-lg leading-relaxed break-words">
              {merchant.description}
            </p>
          </section>
        </FadeIn>
      )}

      {resolvedFeatures.menu && products.length > 0 && (
        <FadeIn>
          <MenuViewTracker slug={merchant.slug} />
          <section id="menu-section" className="py-10 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto">
              <SectionHeading>Menu</SectionHeading>
              <div className="bg-white rounded-lg border-2 border-amber-400/70 p-1.5 shadow-sm">
                <div className="rounded border border-amber-300/70 px-4 py-6 sm:px-8 space-y-8">
                  {categories.map((cat) => {
                    const catProducts = products.filter((p) => p.category_id === cat.id);
                    if (catProducts.length === 0) return null;
                    return (
                      <div key={cat.id}>
                        <h3 className="text-lg font-bold text-red-800 text-center tracking-wide pb-2 mb-2 border-b border-dashed border-amber-400 break-words">
                          {cat.name}
                        </h3>
                        <ul className="divide-y divide-amber-100">
                          {catProducts.map((product) => (
                            <li key={product.id} className="flex gap-3 py-3">
                              {product.image_url && (
                                <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden ring-1 ring-amber-300">
                                  <SafeImage src={product.image_url} alt={product.name} fill className="object-cover" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <h4 className="font-semibold text-stone-900 break-words min-w-0">{product.name}</h4>
                                  {shouldShowPrice(product) && (
                                    <>
                                      <span aria-hidden="true" className="flex-1 min-w-4 border-b border-dotted border-amber-500" />
                                      <span className="font-bold text-red-800 whitespace-nowrap">
                                        {product.discount_price ? (
                                          <><span className="line-through text-stone-500 text-sm font-normal mr-1">RM {product.price}</span>RM {product.discount_price}</>
                                        ) : `RM ${product.price}`}
                                      </span>
                                    </>
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
            </div>
          </section>
        </FadeIn>
      )}

      <TierSections merchant={merchant} products={products} features={features} variant="chinese" events={events} />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6 bg-[#F8EBD9]">
            <div className="max-w-4xl mx-auto">
              <SectionHeading>Visit Us</SectionHeading>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} onClick={() => trackEvent('directions_click', { slug: merchant.slug, pageType: 'merchant' })} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span className="text-sm break-words min-w-0">{merchant.address}</span></a>}
                  {merchant.phone && <a href={`tel:${merchant.phone}`} onClick={() => trackEvent('phone_click', { slug: merchant.slug, pageType: 'merchant' })} className={`flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Phone size={18} /><span className="text-sm">{merchant.phone}</span></a>}
                  {merchant.website && <a href={merchant.website} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('website_click', { slug: merchant.slug, pageType: 'merchant' })} className={`flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Globe size={18} /><span className="text-sm">Website</span></a>}
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
                  {merchant.email && <a href={`mailto:${merchant.email}`} onClick={() => trackEvent('email_click', { slug: merchant.slug, pageType: 'merchant' })} className={`flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Mail size={18} /><span className="text-sm break-all">{merchant.email}</span></a>}
                  {merchant.instagram && <a href={merchant.instagram} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Instagram size={18} /><span className="text-sm">Instagram</span></a>}
                </div>
                <div className="space-y-1.5">
                  {hasHours && DAYS.map((day) => {
                    const time = hours?.[day];
                    if (!time) return null;
                    return (
                      <div key={day} className={`flex justify-between gap-3 py-2 px-3 rounded-md text-sm ${day === today ? "bg-red-800 text-amber-50 font-medium" : "text-stone-700"}`}>
                        <span className="capitalize">{day}</span><span>{formatOperatingHours(time)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Map */}
              <MapEmbed address={merchant.address} borderColor="#FBBF24" />

              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-amber-400/60">
                  <p className="text-xs font-medium uppercase tracking-wider text-red-900 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-red-900 border border-amber-300">
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
              <div className="mt-8 pt-6 border-t border-amber-400/60">
                <p className="text-xs font-medium uppercase tracking-wider text-red-900 mb-3">
                  Share
                </p>
                <ShareButtons slug={merchant.slug} name={merchant.name} variant="chinese" />
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <footer className="bg-red-900 text-center">
        <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
        <div className="py-8 px-4">
          <Link href="/" className={`text-sm text-amber-100 hover:text-white transition-colors ${focusRing} focus-visible:ring-offset-red-900`}>{footerText || "Discover more restaurants on BiteSite"}</Link>
        </div>
      </footer>
    </div>
  );
}
