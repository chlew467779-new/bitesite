/* bitesite/app/layouts/store-layout.tsx */

"use client";

/**
 * The one restaurant page structure (T7, CH 2026-10-05): every page style shows the same
 * sections in the same order, built on the Modern layout CH preferred. Styles differ only in
 * colours and type (PAGE_THEMES below); the shared sections take theirs from lib/layout-theme.mjs.
 * No category chips and no section tabs: the menu is one clean list per category, and a dish
 * shows its photo when it has one.
 *
 * Every class string is a complete literal (Tailwind only generates CSS for names it can find
 * verbatim in the source), so a style is one object of literals, never built by concatenation.
 */

import { DishDescription } from "@/components/sections/dish-description";
import { ListingTags } from "@/components/sections/listing-tags";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { TierSections } from "@/app/components/sections/tier-sections";
import { ShareButtons } from "@/components/sections/share-buttons";
import { mergeFeatures } from "@/types";
import type { LayoutProps } from "@/types";
import type { LayoutKey } from "@/lib/layout-registry.mjs";
import { MapPin, Phone, Mail, Instagram, Facebook, Globe, ArrowLeft, MessageSquare, Clock, Banknote, Smartphone, CreditCard } from "lucide-react";
import { formatPhone, phoneLinkDigits } from "@/lib/phone-core.mjs";
import { trackEvent } from "@/lib/analytics";
import { MenuViewTracker } from "@/components/sections/menu-view-tracker";
import { hasDisplayablePrice } from "@/lib/menu-display.mjs";
import Link from "next/link";
import { getTodayKey, formatOperatingHours, DAYS } from "@/lib/hours";
import { MapEmbed } from "@/app/components/map-embed";
import { formatPrice } from "@/lib/price-format.mjs";

type PageTheme = {
  page: string;
  topBar: string;
  backLink: string;
  chip: string;
  title: string;
  body: string;
  muted: string;
  coverEmpty: string;
  coverLetter: string;
  sectionTitle: string;
  categoryTitle: string;
  dishRow: string;
  dishName: string;
  price: string;
  dishText: string;
  soldOut: string;
  dishPhoto: string;
  contactBg: string;
  link: string;
  whatsapp: string;
  dayToday: string;
  dayOther: string;
  divider: string;
  label: string;
  pill: string;
  mapBorder: string;
  footer: string;
  footerLink: string;
  footerFeedback: string;
};

// Colours follow each style's original palette (registry swatches), on the Modern structure.
const PAGE_THEMES: Record<"classic" | "elegant" | "minimal" | "modern" | "rustic", PageTheme> = {
  modern: {
    page: "min-h-screen bg-white text-slate-800",
    topBar: "sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100",
    backLink: "min-h-11 inline-flex items-center gap-2 text-slate-600 text-sm font-medium active:scale-95 transition-transform",
    chip: "inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold",
    title: "break-words text-4xl lg:text-5xl font-bold text-slate-900 mb-4 leading-tight",
    body: "text-slate-600 leading-relaxed",
    muted: "text-slate-500",
    coverEmpty: "aspect-[4/3] rounded-2xl bg-slate-100 flex items-center justify-center",
    coverLetter: "text-6xl font-bold text-slate-300",
    sectionTitle: "text-2xl font-bold text-slate-900 mb-8",
    categoryTitle: "text-lg font-bold text-slate-800 mb-2 pb-2 border-b-2 border-slate-900",
    dishRow: "flex gap-4 py-4 border-b border-slate-100 last:border-b-0",
    dishName: "font-semibold text-slate-800 break-words",
    price: "font-bold text-slate-900 whitespace-nowrap",
    dishText: "text-sm text-slate-500 mt-1 whitespace-pre-line break-words",
    soldOut: "text-xs text-red-600 mt-1 block",
    dishPhoto: "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100",
    contactBg: "py-12 px-4 bg-slate-50",
    link: "min-h-11 flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors",
    whatsapp: "min-h-11 flex items-center gap-3 text-green-700 hover:text-green-800 transition-colors",
    dayToday: "flex justify-between py-2 px-3 rounded-lg text-sm bg-white shadow-sm text-slate-900 font-medium",
    dayOther: "flex justify-between py-2 px-3 rounded-lg text-sm text-slate-500",
    divider: "mt-8 pt-6 border-t border-slate-200",
    label: "text-xs font-medium uppercase tracking-wider text-slate-500 mb-3",
    pill: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200",
    mapBorder: "#E2E8F0",
    footer: "py-8 px-4 text-center border-t border-slate-100",
    footerLink: "min-h-11 inline-flex items-center text-sm text-slate-500 hover:text-slate-700 transition-colors",
    footerFeedback: "min-h-11 mt-1 flex items-center justify-center text-sm text-slate-500 underline hover:text-slate-700",
  },
  classic: {
    page: "min-h-screen bg-amber-50 text-amber-950",
    topBar: "sticky top-0 z-40 bg-amber-50/85 backdrop-blur-md border-b border-amber-200",
    backLink: "min-h-11 inline-flex items-center gap-2 text-amber-800 text-sm font-medium active:scale-95 transition-transform",
    chip: "inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold",
    title: "break-words font-serif text-4xl lg:text-5xl font-bold text-amber-900 mb-4 leading-tight",
    body: "text-amber-900/80 leading-relaxed",
    muted: "text-amber-800/80",
    coverEmpty: "aspect-[4/3] rounded-2xl bg-amber-100 flex items-center justify-center",
    coverLetter: "font-serif text-6xl font-bold text-amber-300",
    sectionTitle: "font-serif text-2xl font-bold text-amber-900 mb-8",
    categoryTitle: "font-serif text-lg font-bold text-amber-900 mb-2 pb-2 border-b-2 border-amber-800",
    dishRow: "flex gap-4 py-4 border-b border-amber-200/70 last:border-b-0",
    dishName: "font-semibold text-amber-950 break-words",
    price: "font-bold text-amber-800 whitespace-nowrap",
    dishText: "text-sm text-amber-900/70 mt-1 whitespace-pre-line break-words",
    soldOut: "text-xs text-red-700 mt-1 block",
    dishPhoto: "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-amber-100",
    contactBg: "py-12 px-4 bg-amber-100/60",
    link: "min-h-11 flex items-center gap-3 text-amber-900 hover:text-amber-700 transition-colors",
    whatsapp: "min-h-11 flex items-center gap-3 text-green-800 hover:text-green-900 transition-colors",
    dayToday: "flex justify-between py-2 px-3 rounded-lg text-sm bg-white shadow-sm text-amber-950 font-medium",
    dayOther: "flex justify-between py-2 px-3 rounded-lg text-sm text-amber-900/80",
    divider: "mt-8 pt-6 border-t border-amber-200",
    label: "text-xs font-medium uppercase tracking-wider text-amber-800 mb-3",
    pill: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-amber-900 border border-amber-200",
    mapBorder: "#FDE68A",
    footer: "py-8 px-4 text-center border-t border-amber-200",
    footerLink: "min-h-11 inline-flex items-center text-sm text-amber-800 hover:text-amber-900 transition-colors",
    footerFeedback: "min-h-11 mt-1 flex items-center justify-center text-sm text-amber-800 underline hover:text-amber-900",
  },
  elegant: {
    page: "min-h-screen bg-slate-950 text-slate-200",
    topBar: "sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800",
    backLink: "min-h-11 inline-flex items-center gap-2 text-amber-100 text-sm font-medium active:scale-95 transition-transform",
    chip: "inline-block px-3 py-1 rounded-full border border-amber-200/40 text-amber-100 text-xs font-semibold",
    title: "break-words font-serif text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight",
    body: "text-slate-300 leading-relaxed",
    muted: "text-slate-400",
    coverEmpty: "aspect-[4/3] rounded-2xl bg-slate-900 flex items-center justify-center",
    coverLetter: "font-serif text-6xl font-bold text-slate-700",
    sectionTitle: "font-serif text-2xl font-bold text-amber-100 mb-8",
    categoryTitle: "font-serif text-lg font-bold text-amber-100 mb-2 pb-2 border-b border-amber-200/50",
    dishRow: "flex gap-4 py-4 border-b border-slate-800 last:border-b-0",
    dishName: "font-semibold text-white break-words",
    price: "font-bold text-amber-200 whitespace-nowrap",
    dishText: "text-sm text-slate-400 mt-1 whitespace-pre-line break-words",
    soldOut: "text-xs text-red-300 mt-1 block",
    dishPhoto: "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-900",
    contactBg: "py-12 px-4 bg-slate-900",
    link: "min-h-11 flex items-center gap-3 text-slate-300 hover:text-amber-100 transition-colors",
    whatsapp: "min-h-11 flex items-center gap-3 text-green-400 hover:text-green-300 transition-colors",
    dayToday: "flex justify-between py-2 px-3 rounded-lg text-sm bg-slate-800 text-amber-100 font-medium",
    dayOther: "flex justify-between py-2 px-3 rounded-lg text-sm text-slate-400",
    divider: "mt-8 pt-6 border-t border-slate-800",
    label: "text-xs font-medium uppercase tracking-wider text-slate-400 mb-3",
    pill: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700",
    mapBorder: "#1E293B",
    footer: "py-8 px-4 text-center border-t border-slate-800",
    footerLink: "min-h-11 inline-flex items-center text-sm text-slate-400 hover:text-amber-100 transition-colors",
    footerFeedback: "min-h-11 mt-1 flex items-center justify-center text-sm text-slate-400 underline hover:text-amber-100",
  },
  minimal: {
    page: "min-h-screen bg-stone-50 text-stone-800",
    topBar: "sticky top-0 z-40 bg-stone-50/85 backdrop-blur-md border-b border-stone-200",
    backLink: "min-h-11 inline-flex items-center gap-2 text-stone-600 text-sm active:scale-95 transition-transform",
    chip: "inline-block px-3 py-1 rounded-full border border-stone-300 text-stone-600 text-xs font-medium",
    title: "break-words text-4xl lg:text-5xl font-light text-stone-900 mb-4 leading-tight",
    body: "text-stone-600 leading-relaxed",
    muted: "text-stone-500",
    coverEmpty: "aspect-[4/3] rounded-2xl bg-stone-100 flex items-center justify-center",
    coverLetter: "text-6xl font-light text-stone-300",
    sectionTitle: "text-sm font-medium tracking-widest uppercase text-stone-500 mb-8",
    categoryTitle: "text-sm font-semibold uppercase tracking-wider text-stone-800 mb-2 pb-2 border-b border-stone-300",
    dishRow: "flex gap-4 py-4 border-b border-stone-200 last:border-b-0",
    dishName: "font-medium text-stone-900 break-words",
    price: "font-medium text-stone-900 whitespace-nowrap",
    dishText: "text-sm text-stone-500 mt-1 whitespace-pre-line break-words",
    soldOut: "text-xs text-red-600 mt-1 block",
    dishPhoto: "relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100",
    contactBg: "py-12 px-4 bg-white",
    link: "min-h-11 flex items-center gap-3 text-stone-600 hover:text-stone-900 transition-colors",
    whatsapp: "min-h-11 flex items-center gap-3 text-green-700 hover:text-green-800 transition-colors",
    dayToday: "flex justify-between py-2 px-3 rounded-lg text-sm bg-stone-100 text-stone-900 font-medium",
    dayOther: "flex justify-between py-2 px-3 rounded-lg text-sm text-stone-500",
    divider: "mt-8 pt-6 border-t border-stone-200",
    label: "text-xs font-medium uppercase tracking-widest text-stone-500 mb-3",
    pill: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-50 text-stone-700 border border-stone-200",
    mapBorder: "#E7E5E4",
    footer: "py-8 px-4 text-center border-t border-stone-200",
    footerLink: "min-h-11 inline-flex items-center text-sm text-stone-500 hover:text-stone-700 transition-colors",
    footerFeedback: "min-h-11 mt-1 flex items-center justify-center text-sm text-stone-500 underline hover:text-stone-700",
  },
  rustic: {
    page: "min-h-screen bg-orange-50 text-orange-950",
    topBar: "sticky top-0 z-40 bg-orange-50/85 backdrop-blur-md border-b border-orange-200",
    backLink: "min-h-11 inline-flex items-center gap-2 text-orange-800 text-sm font-medium active:scale-95 transition-transform",
    chip: "inline-block px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold",
    title: "break-words font-serif text-4xl lg:text-5xl font-bold text-orange-900 mb-4 leading-tight",
    body: "text-orange-900/80 leading-relaxed",
    muted: "text-orange-800/80",
    coverEmpty: "aspect-[4/3] rounded-2xl bg-orange-100 flex items-center justify-center",
    coverLetter: "font-serif text-6xl font-bold text-orange-300",
    sectionTitle: "font-serif text-2xl font-bold text-orange-900 mb-8",
    categoryTitle: "font-serif text-lg font-bold text-orange-900 mb-2 pb-2 border-b-2 border-orange-800",
    dishRow: "flex gap-4 py-4 border-b border-orange-200/70 last:border-b-0",
    dishName: "font-semibold text-orange-950 break-words",
    price: "font-bold text-orange-800 whitespace-nowrap",
    dishText: "text-sm text-orange-900/70 mt-1 whitespace-pre-line break-words",
    soldOut: "text-xs text-red-700 mt-1 block",
    dishPhoto: "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-orange-100",
    contactBg: "py-12 px-4 bg-orange-100/60",
    link: "min-h-11 flex items-center gap-3 text-orange-900 hover:text-orange-700 transition-colors",
    whatsapp: "min-h-11 flex items-center gap-3 text-green-800 hover:text-green-900 transition-colors",
    dayToday: "flex justify-between py-2 px-3 rounded-lg text-sm bg-white shadow-sm text-orange-950 font-medium",
    dayOther: "flex justify-between py-2 px-3 rounded-lg text-sm text-orange-900/80",
    divider: "mt-8 pt-6 border-t border-orange-200",
    label: "text-xs font-medium uppercase tracking-wider text-orange-800 mb-3",
    pill: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-orange-900 border border-orange-200",
    mapBorder: "#FFEDD5",
    footer: "py-8 px-4 text-center border-t border-orange-200",
    footerLink: "min-h-11 inline-flex items-center text-sm text-orange-800 hover:text-orange-900 transition-colors",
    footerFeedback: "min-h-11 mt-1 flex items-center justify-center text-sm text-orange-800 underline hover:text-orange-900",
  },
};

export type PageStyle = keyof typeof PAGE_THEMES;

export function StoreLayout({
  style, merchant, categories, products, features, events, footerText,
}: LayoutProps & { style: PageStyle }) {
  const t = PAGE_THEMES[style];
  // The shared sections (gallery, featured dishes, events, booking, share) use the same style key.
  const variant: LayoutKey = style;
  const resolvedFeatures = mergeFeatures(features);
  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;
  const hasHours = Boolean(hours && Object.values(hours).some((value) => value?.trim()));

  return (
    <div data-restaurant-layout data-page-style={style} className={t.page}>
      <div data-menu-sticky className={t.topBar}>
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Link href="/" className={t.backLink} style={{ WebkitTapHighlightColor: "transparent" }}>
            <ArrowLeft size={18} /> Back to BiteSite
          </Link>
        </div>
      </div>

      {resolvedFeatures.hero && (
        <FadeIn>
          <div className="max-w-5xl mx-auto px-4 pt-8">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="min-w-0">
                {merchant.cuisine_type && <div className="mb-4"><span className={t.chip}>{merchant.cuisine_type}</span></div>}
                <h1 className={t.title}>{merchant.name}</h1>
                {merchant.description && <p className={t.body}>{merchant.description}</p>}
                {hasHours && (
                  <p className={`mt-4 text-sm flex items-center gap-2 ${t.muted}`}>
                    <Clock size={16} /> Today: {formatOperatingHours(hours?.[today]) || "Closed"}
                  </p>
                )}
              </div>
              {merchant.cover_image ? (
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                  <SafeImage src={merchant.cover_image} alt={merchant.name} fill className="object-cover" priority />
                </div>
              ) : (
                <div className={t.coverEmpty}>
                  <span className={t.coverLetter}>{merchant.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {resolvedFeatures.menu && products.length > 0 && (
        <FadeIn>
          <MenuViewTracker slug={merchant.slug} />
          <section id="menu-section" className="py-12 px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className={t.sectionTitle}>Menu</h2>
              <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category_id === cat.id);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id} className="min-w-0">
                      <h3 className={t.categoryTitle}>{cat.name}</h3>
                      <ul>
                        {catProducts.map((product) => (
                          <li key={product.id} className={t.dishRow}>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between items-baseline gap-3">
                                <h4 className={t.dishName}>{product.name}</h4>
                                {hasDisplayablePrice(product) && (
                                  <span className={t.price}>
                                    {product.discount_price != null ? (
                                      <><span className="line-through opacity-50 text-sm mr-1">{formatPrice(product.price, merchant.currency)}</span>{formatPrice(product.discount_price, merchant.currency)}</>
                                    ) : formatPrice(product.price, merchant.currency)}
                                  </span>
                                )}
                              </div>
                              {product.description && <DishDescription description={product.description} clamp={false} className={t.dishText} />}
                              {!product.is_available && <span className={t.soldOut}>Currently Unavailable</span>}
                            </div>
                            {product.image_url && (
                              <div className={t.dishPhoto}>
                                <SafeImage src={product.image_url} alt={product.name} fill sizes="80px" className="object-cover" />
                              </div>
                            )}
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

      <TierSections merchant={merchant} categories={categories} products={products} features={features} variant={variant} events={events} />

      {resolvedFeatures.contact && (
        <FadeIn>
          <section className={t.contactBg}>
            <div className="max-w-5xl mx-auto">
              <h2 className={t.sectionTitle}>Visit Us</h2>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="min-w-0 space-y-2">
                  {merchant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`} onClick={() => trackEvent('directions_click', { slug: merchant.slug, pageType: 'merchant' })} target="_blank" rel="noopener noreferrer" className={t.link}><MapPin size={18} className="flex-shrink-0" /><span className="text-sm break-words">{merchant.address}</span></a>}
                  {merchant.phone && <a href={`tel:+${phoneLinkDigits(merchant.phone)}`} onClick={() => trackEvent('phone_click', { slug: merchant.slug, pageType: 'merchant' })} className={t.link}><Phone size={18} /><span className="text-sm">{formatPhone(merchant.phone)}</span></a>}
                  {merchant.website && <a href={merchant.website} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('website_click', { slug: merchant.slug, pageType: 'merchant' })} className={t.link}><Globe size={18} /><span className="text-sm">Website</span></a>}
                  {merchant.instagram && <a href={merchant.instagram} target="_blank" rel="noopener noreferrer" className={t.link}><Instagram size={18} /><span className="text-sm">Instagram</span></a>}
                  {merchant.facebook && <a href={merchant.facebook} target="_blank" rel="noopener noreferrer" className={t.link}><Facebook size={18} /><span className="text-sm">Facebook</span></a>}
                  {merchant.whatsapp && (
                    <a
                      href={`https://wa.me/${phoneLinkDigits(merchant.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent('whatsapp_click', { slug: merchant.slug, pageType: 'merchant' })}
                      className={t.whatsapp}
                    >
                      <MessageSquare size={18} /><span className="text-sm font-medium">WhatsApp</span>
                    </a>
                  )}
                  {merchant.email && <a href={`mailto:${merchant.email}`} onClick={() => trackEvent('email_click', { slug: merchant.slug, pageType: 'merchant' })} className={t.link}><Mail size={18} /><span className="text-sm break-all">{merchant.email}</span></a>}
                </div>
                <div className="space-y-2">
                  {hasHours && DAYS.map((day) => {
                    const time = hours?.[day];
                    if (!time) return null;
                    return (
                      <div key={day} className={day === today ? t.dayToday : t.dayOther}>
                        <span className="capitalize">{day}</span><span>{formatOperatingHours(time)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <MapEmbed address={merchant.address} latitude={merchant.latitude} longitude={merchant.longitude} borderColor={t.mapBorder} />

              {merchant.payment_methods && merchant.payment_methods.length > 0 && (
                <div className={t.divider}>
                  <p className={t.label}>Payment Methods</p>
                  <div className="flex flex-wrap gap-2">
                    {merchant.payment_methods.map((method) => (
                      <span key={method} className={t.pill}>
                        {method === "Cash" && <Banknote className="h-3 w-3" />}
                        {method === "Cashless" && <Smartphone className="h-3 w-3" />}
                        {method === "Cards" && <CreditCard className="h-3 w-3" />}
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <ListingTags amenities={merchant.amenities} occasion={merchant.occasion} wrapperClass={t.divider} labelClass={t.label} chipClass={t.pill} />

              <div className={t.divider}>
                <p className={t.label}>Share</p>
                <ShareButtons slug={merchant.slug} name={merchant.name} variant={variant} />
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      <footer className={t.footer}>
        <Link href="/" className={t.footerLink}>{footerText || "Discover more restaurants on BiteSite"}</Link>
        <Link href="/feedback" className={t.footerFeedback}>Send feedback</Link>
      </footer>
    </div>
  );
}
