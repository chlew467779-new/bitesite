/* bitesite/app/layouts/malay-layout.tsx */

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
 * Malay layout — a restrained emerald accent on a warm, readable canvas.
 *
 * Public since C3 (productionReady: true in lib/layout-registry.mjs). Shared sections
 * take their colours from the `malay` theme in lib/layout-theme.mjs.
 */

const focusRing =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-emerald-900 break-words">{children}</h2>
      <span aria-hidden="true" className="mt-3 inline-block h-0.5 w-10 bg-emerald-800" />
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
    <div data-restaurant-layout className="min-h-screen bg-[#F8F6EF] text-stone-900">
      <div data-menu-sticky className="sticky top-0 z-40 bg-[#F8F6EF]/90 backdrop-blur-md border-b border-emerald-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/" className={`min-h-11 inline-flex items-center gap-2 text-emerald-900 text-sm font-medium active:scale-95 transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="relative">
            <div className={`relative ${merchant.cover_image ? "h-56 sm:h-80 bg-emerald-800" : "h-24 sm:h-32 bg-emerald-50"}`}>
              {merchant.cover_image ? (
                <div className="absolute inset-0">
                  <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/70 to-transparent" />
                </div>
              ) : null}
            </div>
            <div className="max-w-4xl mx-auto px-4 -mt-16 sm:-mt-20 relative z-10">
              <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-stone-200">
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
                <MenuCategoryNav categories={categories} products={products} variant="malay" />
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id} id={menuCategoryId(cat.id)} className="scroll-mt-32 bg-white rounded-xl border border-stone-200 overflow-hidden">
                      <h3 tabIndex={-1} className="px-5 py-3 text-lg font-bold text-emerald-900 border-b border-stone-200 break-words">{cat.name}</h3>
                      <ul className="divide-y divide-emerald-50 px-5">
                        {catProducts.map((product) => (
                          <li key={product.id} className="flex gap-3 py-4">
                            {product.image_url && (
                              <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden">
                                <SafeImage src={product.image_url} alt={product.name} fill className="object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col items-start gap-1">
                                <h4 className="font-semibold text-stone-900 break-words min-w-0">{product.name}</h4>
                                {hasDisplayablePrice(product) && (
                                  <span className="font-bold text-emerald-800 whitespace-nowrap">
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

      <TierSections merchant={merchant} categories={categories} products={products} features={features} variant="malay" events={events} />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className="py-12 px-4 sm:px-6 bg-white">
            <div className="max-w-4xl mx-auto">
              <SectionHeading>Find Us</SectionHeading>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} onClick={() => trackEvent('directions_click', { slug: merchant.slug, pageType: 'merchant' })} target="_blank" rel="noopener noreferrer" className={`min-h-11 flex items-start gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span className="text-sm break-words min-w-0">{merchant.address}</span></a>}
                  {merchant.phone && <a href={`tel:+${phoneLinkDigits(merchant.phone)}`} onClick={() => trackEvent('phone_click', { slug: merchant.slug, pageType: 'merchant' })} className={`min-h-11 flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Phone size={18} /><span className="text-sm">{formatPhone(merchant.phone)}</span></a>}
                  {merchant.website && <a href={merchant.website} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('website_click', { slug: merchant.slug, pageType: 'merchant' })} className={`min-h-11 flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Globe size={18} /><span className="text-sm">Website</span></a>}
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
                  {merchant.email && <a href={`mailto:${merchant.email}`} onClick={() => trackEvent('email_click', { slug: merchant.slug, pageType: 'merchant' })} className={`min-h-11 flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Mail size={18} /><span className="text-sm break-all">{merchant.email}</span></a>}
                  {merchant.instagram && <a href={merchant.instagram} target="_blank" rel="noopener noreferrer" className={`min-h-11 flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Instagram size={18} /><span className="text-sm">Instagram</span></a>}
                  {merchant.facebook && <a href={merchant.facebook} target="_blank" rel="noopener noreferrer" className={`min-h-11 flex items-center gap-3 text-emerald-900 active:scale-[0.98] transition-transform ${focusRing}`} style={{ WebkitTapHighlightColor: "transparent" }}><Facebook size={18} /><span className="text-sm">Facebook</span></a>}
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
              <MapEmbed address={merchant.address} latitude={merchant.latitude} longitude={merchant.longitude} borderColor="#A7F3D0" />

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

              <ListingTags amenities={merchant.amenities} occasion={merchant.occasion} wrapperClass="mt-8 pt-6 border-t border-emerald-100" labelClass="text-xs font-medium uppercase tracking-wider text-emerald-900 mb-3" chipClass="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200" />

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
        <div className="py-8 px-4">
          <Link href="/" className={`text-sm text-amber-50 hover:text-white transition-colors ${focusRing} focus-visible:ring-offset-emerald-900`}>{footerText || "Discover more restaurants on BiteSite"}</Link>
          <Link href="/feedback" className={`min-h-11 mt-1 flex items-center justify-center text-sm text-amber-50 underline hover:text-white ${focusRing} focus-visible:ring-offset-emerald-900`}>Send feedback</Link>
        </div>
      </footer>
    </div>
  );
}
