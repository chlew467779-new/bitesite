/* bitesite/app/layouts/store-layout.tsx */

"use client";

/**
 * The one restaurant page (R2 redesign, CH 2026-10-06; design: Documents\Codex\2026-10-06\design\Store).
 * Phone first: cover photo, name card, four quick actions, "Popular here", a searchable menu,
 * one "Hours & location" card. Every page style is this same structure; a style only changes the
 * colour tokens (STYLE_COLOURS) that the shared parts in components/ui/ read, so "elegant" is a
 * dark page without any extra markup. Shared sections that follow the menu (jobs, nearby,
 * report, footer) come in as children so they sit inside the themed page.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft, MessageCircle, Phone, Navigation, CalendarDays, Globe, Instagram, Facebook, Mail,
} from "lucide-react";
import { DishDescription } from "@/components/sections/dish-description";
import { ListingTags } from "@/components/sections/listing-tags";
import { SafeImage } from "@/app/components/safe-image";
import { TierSections } from "@/app/components/sections/tier-sections";
import { AppointmentSection } from "@/app/components/sections/appointment-section";
import { MenuViewTracker } from "@/components/sections/menu-view-tracker";
import { MapEmbed } from "@/app/components/map-embed";
import { OpenStatusPill } from "@/components/store/open-status-pill";
import { StoreShareButton } from "@/components/store/store-share-button";
import { FavouriteButton } from "@/components/store/favourite-button";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { buttonClasses } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { Sheet } from "@/components/ui/sheet";
import { mergeFeatures } from "@/types";
import type { LayoutProps, Product } from "@/types";
import { formatPhone, phoneLinkDigits } from "@/lib/phone-core.mjs";
import { trackEvent } from "@/lib/analytics";
import { hasDisplayablePrice } from "@/lib/menu-display.mjs";
import { getTodayKey, formatOperatingHours, DAYS } from "@/lib/hours";
import { formatPrice } from "@/lib/price-format.mjs";
import { normalizeBookingWhatsApp } from "@/lib/merchant-booking-target.mjs";
import { priceRange } from "@/lib/store-summary.mjs";
import { cn } from "@/lib/utils";

type StyleKey = "classic" | "elegant" | "minimal" | "modern" | "rustic";

// Colour per page style (docs/DESIGN.md "Restaurant page styles"). Only token values change.
const STYLE_COLOURS: Record<StyleKey, CSSProperties> = {
  // Forest — the site defaults.
  modern: {},
  // Amber
  classic: { "--color-brand": "#8A4B0F", "--color-brand-hover": "#723D0B", "--color-brand-soft": "#F7EBDD" } as CSSProperties,
  // Chilli
  rustic: { "--color-brand": "#A2341F", "--color-brand-hover": "#862A18", "--color-brand-soft": "#F8E5E0" } as CSSProperties,
  // Stone
  minimal: { "--color-brand": "#44403C", "--color-brand-hover": "#292524", "--color-brand-soft": "#EFEDEA" } as CSSProperties,
  // Night: dark page, gold accent.
  elegant: {
    "--color-page": "#0F172A",
    "--color-ink": "#F8FAFC",
    "--color-ink-2": "#CBD5E1",
    "--color-muted": "#94A3B8",
    "--color-surface": "#1E293B",
    "--color-line": "#334155",
    "--color-line-strong": "#475569",
    "--color-brand": "#FDE68A",
    "--color-brand-hover": "#FCD34D",
    "--color-brand-soft": "#1E293B",
    "--color-on-brand": "#0F172A",
    colorScheme: "dark",
  } as CSSProperties,
};

export type PageStyle = StyleKey;

// A long menu starts folded so the hours, map and delivery buttons are not 3000px away.
const FOLD_OVER = 12;
const FOLDED_COUNT = 8;
const QUICK_GRID = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

function priceText(product: Product, merchant: { currency: string | null | undefined }) {
  return product.discount_price != null ? (
    <>
      <span className="mr-1.5 font-medium text-muted line-through">{formatPrice(product.price, merchant.currency)}</span>
      <span className="text-brand">{formatPrice(product.discount_price, merchant.currency)}</span>
    </>
  ) : (
    formatPrice(product.price, merchant.currency)
  );
}

export function StoreLayout({
  style, merchant, categories, products, features, events, children,
}: LayoutProps & { style: PageStyle; children?: ReactNode }) {
  const resolvedFeatures = mergeFeatures(features);
  const today = getTodayKey();
  const hours = merchant.operating_hours as Record<string, string> | null;
  const hasHours = Boolean(hours && Object.values(hours).some((value) => value?.trim()));
  const range = priceRange(products, merchant.currency);
  const canBook = resolvedFeatures.appointment && normalizeBookingWhatsApp(merchant.whatsapp) !== null;
  const [bookingOpen, setBookingOpen] = useState(false);

  const featured = products.filter((p) => p.is_featured).slice(0, 10);
  const directionsHref =
    merchant.latitude != null && merchant.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${merchant.latitude},${merchant.longitude}`
      : merchant.address
        ? `https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`
        : null;

  const quickActions: { key: string; label: string; icon: ReactNode; href?: string; onClick?: () => void; primary?: boolean; external?: boolean }[] = [];
  if (resolvedFeatures.contact && merchant.whatsapp) {
    quickActions.push({
      key: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={22} aria-hidden />, primary: true, external: true,
      href: `https://wa.me/${phoneLinkDigits(merchant.whatsapp)}`,
      onClick: () => trackEvent("whatsapp_click", { slug: merchant.slug, pageType: "merchant" }),
    });
  }
  if (resolvedFeatures.contact && merchant.phone) {
    quickActions.push({
      key: "call", label: "Call", icon: <Phone size={22} aria-hidden />,
      href: `tel:+${phoneLinkDigits(merchant.phone)}`,
      onClick: () => trackEvent("phone_click", { slug: merchant.slug, pageType: "merchant" }),
    });
  }
  if (resolvedFeatures.contact && directionsHref) {
    quickActions.push({
      key: "directions", label: "Directions", icon: <Navigation size={22} aria-hidden />, href: directionsHref, external: true,
      onClick: () => trackEvent("directions_click", { slug: merchant.slug, pageType: "merchant" }),
    });
  }
  if (canBook) {
    quickActions.push({ key: "book", label: "Book", icon: <CalendarDays size={22} aria-hidden />, onClick: () => setBookingOpen(true) });
  }
  if (quickActions.length > 0 && !quickActions.some((a) => a.primary)) quickActions[0].primary = true;

  const meta = [merchant.cuisine_type, merchant.area, range].filter(Boolean).join(" · ");
  const socialLinks = [
    merchant.website && { key: "website", href: merchant.website, label: "Website", icon: <Globe size={18} aria-hidden />, event: "website_click" as const },
    merchant.instagram && { key: "instagram", href: merchant.instagram, label: "Instagram", icon: <Instagram size={18} aria-hidden /> },
    merchant.facebook && { key: "facebook", href: merchant.facebook, label: "Facebook", icon: <Facebook size={18} aria-hidden /> },
    merchant.email && { key: "email", href: `mailto:${merchant.email}`, label: "Email", icon: <Mail size={18} aria-hidden />, event: "email_click" as const },
  ].filter(Boolean) as { key: string; href: string; label: string; icon: ReactNode; event?: "website_click" | "email_click" }[];
  const pillClass = "inline-flex min-h-[30px] items-center rounded-full border border-line bg-page px-3 text-[13px] font-semibold text-ink";

  return (
    <div data-restaurant-layout data-page-style={style} className="min-h-screen bg-page text-ink" style={STYLE_COLOURS[style]}>
      {/* Cover */}
      <div className="relative md:mx-auto md:max-w-5xl md:px-4 md:pt-4">
        <div className="relative h-[250px] overflow-hidden bg-surface md:h-[380px] md:rounded-3xl">
          {resolvedFeatures.hero && merchant.cover_image ? (
            <SafeImage src={merchant.cover_image} alt={merchant.name} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-brand-soft">
              <span aria-hidden className="text-7xl font-extrabold text-brand opacity-40">{merchant.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <Link href="/" aria-label="Back to BiteSite" className={iconButtonClasses({ variant: "overlay" })}>
              <ChevronLeft size={22} aria-hidden />
            </Link>
            <div className="flex gap-2">
              <FavouriteButton slug={merchant.slug} name={merchant.name} />
              <StoreShareButton slug={merchant.slug} name={merchant.name} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        {/* Name card, overlapping the cover on phones */}
        <section className="relative -mt-7 rounded-t-[28px] bg-page px-4 pt-[22px] md:mt-0 md:pt-6">
          {merchant.logo_image && (
            <div className="absolute -top-9 right-4 size-[72px] overflow-hidden rounded-[20px] border-4 border-page bg-page shadow-sm md:static md:mb-3 md:size-20">
              <SafeImage src={merchant.logo_image} alt={`${merchant.name} logo`} fill sizes="80px" className="object-cover" />
            </div>
          )}
          <div className="flex min-h-7 flex-wrap gap-2">
            {hasHours && <OpenStatusPill todayHours={hours?.[today]} />}
          </div>
          <h1 className="mt-2.5 break-words text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-4xl">{merchant.name}</h1>
          {meta && <p className="mt-1.5 text-[15px] text-muted">{meta}</p>}
          {merchant.description && (
            <p className="mt-2.5 max-w-2xl whitespace-pre-line text-[15px] leading-[1.55] text-ink-2">{merchant.description}</p>
          )}
        </section>

        {/* Quick actions */}
        {quickActions.length > 0 && (
          <nav aria-label="Contact" className={cn("grid max-w-xl gap-2 px-4 pt-4", QUICK_GRID[quickActions.length])}>
            {quickActions.map((action) => {
              const look = cn(
                "flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-bold transition-colors [-webkit-tap-highlight-color:transparent]",
                action.primary ? "bg-brand-soft text-brand" : "bg-surface text-ink hover:bg-line"
              );
              return action.href ? (
                <a
                  key={action.key}
                  href={action.href}
                  onClick={action.onClick}
                  {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={look}
                >
                  {action.icon}{action.label}
                </a>
              ) : (
                <button key={action.key} type="button" onClick={action.onClick} className={look}>
                  {action.icon}{action.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Popular here (the Owner's "featured" dishes) */}
        {resolvedFeatures.seasonal_popup && featured.length > 0 && (
          <section aria-labelledby="popular-heading" className="pt-7">
            <SectionTitle id="popular-heading" className="px-4">Popular here</SectionTitle>
            <ul className="mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {featured.map((product) => (
                <li key={product.id} className="flex w-[150px] shrink-0 snap-start flex-col gap-1.5">
                  <div className="relative size-[150px] overflow-hidden rounded-[18px] bg-surface">
                    {product.image_url ? (
                      <SafeImage src={product.image_url} alt={product.name} fill sizes="150px" className="object-cover" />
                    ) : (
                      <span aria-hidden className="flex h-full items-center justify-center text-4xl font-extrabold text-muted opacity-40">{product.name.charAt(0)}</span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-[15px] font-bold leading-snug">{product.name}</span>
                  {hasDisplayablePrice(product) && (
                    <span className="text-sm font-bold text-brand">{product.discount_price != null ? formatPrice(product.discount_price, merchant.currency) : formatPrice(product.price, merchant.currency)}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Menu */}
        {resolvedFeatures.menu && products.length > 0 && (
          <>
            <MenuViewTracker slug={merchant.slug} />
            <StoreMenu categories={categories} products={products} merchant={merchant} />
          </>
        )}
      </div>

      {/* Gallery and events keep their own sections; featured dishes and booking are shown above. */}
      <TierSections
        merchant={merchant}
        categories={categories}
        products={products}
        features={{ ...resolvedFeatures, seasonal_popup: false, appointment: false }}
        variant={style}
        events={events}
      />

      {/* Hours & location */}
      {resolvedFeatures.contact && (
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <section aria-labelledby="visit-heading" className="flex flex-col gap-3.5 rounded-[22px] bg-surface p-[18px]">
            <h2 id="visit-heading" className="text-lg font-extrabold">Hours &amp; location</h2>
            {hasHours && (
              <>
                <div className="flex justify-between gap-3 text-[15px] font-bold">
                  <span>Today <span className="font-semibold capitalize text-muted">({today.slice(0, 3)})</span></span>
                  <span className="text-right">{formatOperatingHours(hours?.[today]) || "Closed"}</span>
                </div>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">See all opening hours</span>
                    <span className="hidden group-open:inline">Hide opening hours</span>
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {DAYS.map((day) => {
                      const time = hours?.[day];
                      if (!time) return null;
                      return (
                        <li key={day} className={cn("flex justify-between gap-3 rounded-lg px-3 py-2 text-sm", day === today ? "bg-page font-bold text-ink" : "text-ink-2")}>
                          <span className="capitalize">{day}</span><span className="text-right">{formatOperatingHours(time)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </>
            )}
            <MapEmbed address={merchant.address} latitude={merchant.latitude} longitude={merchant.longitude} borderColor="var(--color-line)" />
            {merchant.address && <p className="text-[15px] leading-normal text-ink-2 break-words">{merchant.address}</p>}
            {merchant.phone && <p className="text-sm text-muted">{formatPhone(merchant.phone)}</p>}

            {merchant.payment_methods && merchant.payment_methods.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Payment</p>
                <ul className="flex flex-wrap gap-2">
                  {merchant.payment_methods.map((method) => <li key={method} className={pillClass}>{method}</li>)}
                </ul>
              </div>
            )}
            <ListingTags amenities={merchant.amenities} occasion={merchant.occasion} wrapperClass="" labelClass="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted" chipClass={pillClass} />

            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {socialLinks.map((link) => (
                  <a
                    key={link.key}
                    href={link.href}
                    {...(link.key === "email" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                    onClick={link.event ? () => trackEvent(link.event!, { slug: merchant.slug, pageType: "merchant" }) : undefined}
                    className={buttonClasses({ variant: "secondary", size: "md" })}
                  >
                    {link.icon}{link.label}
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {children}

      {canBook && (
        <Sheet open={bookingOpen} onClose={() => setBookingOpen(false)} title="Book a table">
          <AppointmentSection bare merchantName={merchant.name} whatsapp={merchant.whatsapp} slug={merchant.slug} />
        </Sheet>
      )}
    </div>
  );
}

/** Menu with a dish search; long menus start folded. One list per category, photo on the right. */
function StoreMenu({ categories, products, merchant }: Pick<LayoutProps, "categories" | "products" | "merchant">) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(
    () => categories
      .map((cat) => ({ cat, items: products.filter((p) => p.category_id === cat.id) }))
      .filter((group) => group.items.length > 0),
    [categories, products],
  );
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const needle = query.trim().toLowerCase();
  const folded = !needle && !expanded && total > FOLD_OVER;

  let shown = 0;
  const visible = groups
    .map(({ cat, items }) => {
      let list = needle
        ? items.filter((p) => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(needle))
        : items;
      if (folded) {
        list = list.slice(0, Math.max(0, FOLDED_COUNT - shown));
        shown += list.length;
      }
      return { cat, items: list };
    })
    .filter((group) => group.items.length > 0);

  return (
    <section id="menu-section" aria-labelledby="menu-heading" className="scroll-mt-4 px-4 pt-7">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle id="menu-heading">Menu</SectionTitle>
        {total > 6 && (
          <SearchInput
            label="Find a dish"
            placeholder="Find a dish"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            wrapperClassName="h-11 max-w-[200px] flex-1 rounded-xl px-3"
          />
        )}
      </div>

      {visible.length === 0 && <p className="py-6 text-[15px] text-muted">No dishes match &ldquo;{query.trim()}&rdquo;.</p>}

      <div className="md:grid md:grid-cols-2 md:gap-x-12">
        {visible.map(({ cat, items }) => (
          <div key={cat.id} className="min-w-0">
            <h3 className="mb-0.5 mt-5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">{cat.name}</h3>
            <ul>
              {items.map((product) => (
                <li key={product.id} className="flex gap-3.5 border-b border-line py-3.5 last:border-b-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h4 className={cn("break-words text-base font-bold", !product.is_available && "text-muted")}>{product.name}</h4>
                    {product.description && <DishDescription description={product.description} className="text-sm leading-[1.45] text-muted whitespace-pre-line break-words" />}
                    {hasDisplayablePrice(product) && (
                      <span className="mt-0.5 text-[15px] font-bold">{priceText(product, merchant)}</span>
                    )}
                    {!product.is_available && <StatusPill tone="soldout" className="mt-1 self-start">Sold out today</StatusPill>}
                  </div>
                  {product.image_url && (
                    <div className={cn("relative size-[84px] shrink-0 overflow-hidden rounded-[14px] bg-surface", !product.is_available && "opacity-60")}>
                      <SafeImage src={product.image_url} alt={product.name} fill sizes="84px" className="object-cover" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {folded && (
        <button type="button" onClick={() => setExpanded(true)} className={cn(buttonClasses({ variant: "secondary", size: "lg", block: true }), "mt-3")}>
          Show full menu ({total} dishes)
        </button>
      )}
    </section>
  );
}
