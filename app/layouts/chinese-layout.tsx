/* bitesite/app/layouts/chinese-layout.tsx */

"use client";

import type { ReactNode } from "react";
import { DishDescription } from "@/components/sections/dish-description";
import { MenuCategoryNav, menuCategoryId } from "@/components/sections/menu-category-nav";
import { ListingTags } from "@/components/sections/listing-tags";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { ShareButtons } from "@/components/sections/share-buttons";
import { mergeFeatures } from "@/types";
import type { LayoutProps } from "@/types";
import { MapPin, Phone, Mail, Instagram, Facebook, Globe, ArrowLeft, MessageSquare, Clock, Banknote, Smartphone, CreditCard } from "lucide-react";
import { formatPhone, phoneLinkDigits } from "@/lib/phone-core.mjs";
import { trackEvent } from "@/lib/analytics";
import { MenuViewTracker } from "@/components/sections/menu-view-tracker";
import { hasDisplayablePrice } from "@/lib/menu-display.mjs";
import Link from "next/link";
import { getTodayKey, formatOperatingHours, DAYS } from "@/lib/hours";
import { MapEmbed } from "@/app/components/map-embed";
import { formatPrice } from "@/lib/price-format.mjs";

/**
 * Chinese layout — a simple warm canvas with a small red seal accent.
 *
 * Public since C3 (productionReady: true in lib/layout-registry.mjs). Shared sections
 * take their colours from the `chinese` theme in lib/layout-theme.mjs.
 */

const focusRing =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="text-2xl font-bold text-stone-900 break-words">{children}</h2>
      <span aria-hidden="true" className="mt-3 inline-block h-0.5 w-10 bg-red-800" />
    </div>
  );
}

export function ChineseLayout({
  merchant, categories, products, features, events, footerText,
}: LayoutProps) {
  const resolvedFeatures = mergeFeatures(features);
  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;
  const hasHours = Boolean(hours && Object.values(hours).some((value) => value?.trim()));
  // First character, not first UTF-16 unit, so CJK and emoji names get a whole glyph.
  const seal = (Array.from(merchant.name.trim())[0] ?? "").toUpperCase();

  return (
    <div data-restaurant-layout className="min-h-screen bg-[#FAF8F5] text-stone-900">
      <div data-menu-sticky className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/" className={`min-h-11 inline-flex items-center gap-2 text-red-900 text-sm font-medium active:scale-95 transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className={`relative min-h-64 sm:min-h-80 flex items-end ${merchant.cover_image ? "bg-stone-800" : "bg-stone-100"}`}>
            {merchant.cover_image ? (
              <div className="absolute inset-0">
                <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-900/20 to-transparent" />
              </div>
            ) : (
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-stone-100 to-stone-200" />
            )}
            <div className="relative w-full max-w-4xl mx-auto px-6 sm:px-8 pt-16 pb-8 sm:pb-10">
              <div className="flex items-start gap-3 sm:gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded bg-red-800 text-xl font-bold text-white"
                >
                  {seal}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {merchant.cuisine_type && <span className={`text-xs font-semibold ${merchant.cover_image ? "text-white" : "text-stone-600"}`}>{merchant.cuisine_type}</span>}
                  </div>
                  <h1 className={`text-[1.625rem] leading-tight sm:text-4xl font-bold break-words ${merchant.cover_image ? "text-white" : "text-stone-900"}`}>{merchant.name}</h1>
                  {hasHours && <p className={`mt-2 text-sm sm:text-base flex items-center gap-2 ${merchant.cover_image ? "text-stone-100" : "text-stone-700"}`}><Clock size={16} /> Today: {formatOperatingHours(hours?.[today]) || "Closed"}</p>}
                </div>
              </div>
            </div>
          </div>
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
              <div className="bg-white rounded-lg border border-stone-200 px-4 py-6 sm:px-8 space-y-8">
                <MenuCategoryNav categories={categories} products={products} variant="chinese" />
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                      <div key={cat.id} id={menuCategoryId(cat.id)} className="scroll-mt-32">
                        <h3 tabIndex={-1} className="text-lg font-bold text-stone-900 pb-2 mb-2 border-b border-stone-200 break-words">
                          {cat.name}
                        </h3>
                        <ul className="divide-y divide-stone-100">
                          {catProducts.map((product) => (
                            <li key={product.id} className="flex gap-3 py-3">
                              {product.image_url && (
                                <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden">
                                  <SafeImage src={product.image_url} alt={product.name} fill className="object-cover" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                                  <h4 className="font-semibold text-stone-900 break-words min-w-0">{product.name}</h4>
                                  {hasDisplayablePrice(product) && (
                                    <span className="font-semibold text-stone-800 whitespace-nowrap">
                                      {product.discount_price != null ? (
                                        <><span className="line-through text-stone-500 text-sm font-normal mr-1">{formatPrice(product.price, merchant.currency)}</span>{formatPrice(product.discount_price, merchant.currency)}</>
                                      ) : formatPrice(product.price, merchant.currency)}
                                    </span>
                                  )}
                                </div>
                                {product.description && <DishDescription description={product.description} className="text-sm text-stone-600 mt-1 break-words whitespace-pre-line break-words" />}
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

      <TierSections merchant={merchant} categories={categories} products={products} features={features} variant="chinese" events={events} />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-10 px-4 sm:px-6 bg-white">
            <div className="max-w-4xl mx-auto">
              <SectionHeading>Visit Us</SectionHeading>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} onClick={() => trackEvent('directions_click', { slug: merchant.slug, pageType: 'merchant' })} target="_blank" rel="noopener noreferrer" className={`min-h-11 flex items-start gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span className="text-sm break-words min-w-0">{merchant.address}</span></a>}
                  {merchant.phone && <a href={`tel:+${phoneLinkDigits(merchant.phone)}`} onClick={() => trackEvent('phone_click', { slug: merchant.slug, pageType: 'merchant' })} className={`min-h-11 flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Phone size={18} /><span className="text-sm">{formatPhone(merchant.phone)}</span></a>}
                  {merchant.website && <a href={merchant.website} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('website_click', { slug: merchant.slug, pageType: 'merchant' })} className={`min-h-11 flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Globe size={18} /><span className="text-sm">Website</span></a>}
                  {merchant.whatsapp && (
                    <a
                      href={`https://wa.me/${phoneLinkDigits(merchant.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent('whatsapp_click', { slug: merchant.slug, pageType: 'merchant' })}
                      className={`min-h-11 flex items-center gap-3 text-green-800 active:scale-[0.98] transition-transform ${focusRing}`}
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <MessageSquare size={18} /><span className="text-sm font-medium">WhatsApp</span>
                    </a>
                  )}
                  {merchant.email && <a href={`mailto:${merchant.email}`} onClick={() => trackEvent('email_click', { slug: merchant.slug, pageType: 'merchant' })} className={`min-h-11 flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Mail size={18} /><span className="text-sm break-all">{merchant.email}</span></a>}
                  {merchant.instagram && <a href={merchant.instagram} target="_blank" rel="noopener noreferrer" className={`min-h-11 flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Instagram size={18} /><span className="text-sm">Instagram</span></a>}
                  {merchant.facebook && <a href={merchant.facebook} target="_blank" rel="noopener noreferrer" className={`min-h-11 flex items-center gap-3 text-red-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Facebook size={18} /><span className="text-sm">Facebook</span></a>}
                </div>
                <div className="space-y-1.5">
                  {hasHours && DAYS.map((day) => {
                    const time = hours?.[day];
                    if (!time) return null;
                    return (
                      <div key={day} className={`flex justify-between gap-3 py-2 px-3 rounded-md text-sm ${day === today ? "bg-stone-100 text-stone-900 font-medium" : "text-stone-700"}`}>
                        <span className="capitalize">{day}</span><span>{formatOperatingHours(time)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Map */}
              <MapEmbed address={merchant.address} latitude={merchant.latitude} longitude={merchant.longitude} borderColor="#E7E5E4" />

              {/* Payment Methods */}
              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-stone-200">
                  <p className="text-xs font-medium uppercase tracking-wider text-red-900 mb-3">
                    Payment Methods
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-50 text-stone-800 border border-stone-200">
                        {method === "Cash" && <Banknote className="h-3 w-3" />}
                        {method === "Cashless" && <Smartphone className="h-3 w-3" />}
                        {method === "Cards" && <CreditCard className="h-3 w-3" />}
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <ListingTags amenities={merchant.amenities} occasion={merchant.occasion} wrapperClass="mt-8 pt-6 border-t border-stone-200" labelClass="text-xs font-medium uppercase tracking-wider text-stone-700 mb-3" chipClass="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-stone-50 text-stone-800 border border-stone-200" />

              {/* Share */}
              <div className="mt-8 pt-6 border-t border-stone-200">
                <p className="text-xs font-medium uppercase tracking-wider text-red-900 mb-3">
                  Share
                </p>
                <ShareButtons slug={merchant.slug} name={merchant.name} variant="chinese" />
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <footer className="bg-stone-900 text-center">
        <div className="py-8 px-4">
          <Link href="/" className={`text-sm text-stone-100 hover:text-white transition-colors ${focusRing} focus-visible:ring-offset-stone-900`}>{footerText || "Discover more restaurants on BiteSite"}</Link>
          <Link href="/feedback" className={`min-h-11 mt-1 flex items-center justify-center text-sm text-stone-100 underline hover:text-white ${focusRing} focus-visible:ring-offset-stone-900`}>Send feedback</Link>
        </div>
      </footer>
    </div>
  );
}
