/* bitesite/app/store/[merchant]/page.tsx */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
  getVideosByMerchant,
  getPublishedMerchants,
  getRelatedMerchants,
  getEventsByMerchant,
} from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { layouts } from "@/app/layouts";
import { describeLayoutValueForLog, resolvePublicLayoutKey } from "@/lib/layout-registry.mjs";
import { RelatedMerchants } from "@/components/sections/related-merchants";
import { ViewTracker } from "@/components/sections/view-tracker";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { GrabFoodOrderButton } from "@/components/sections/grabfood-order-button";
import { getSiteUrl } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/safe-json-ld.mjs";
import type { PublicMerchant } from "@/types";

export const revalidate = 60;

// Since D1b the public read cannot return reviews at all (column grants); this stays as a second guard.
function withoutLegacyReviews<T extends PublicMerchant>(merchant: T): T {
  return { ...merchant, reviews: null };
}

type PageProps = {
  params: Promise<{ merchant: string }>;
};

export async function generateStaticParams() {
  const merchants = await getPublishedMerchants();
  return merchants.map((m) => ({ merchant: m.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const { merchant: slug } = await params;
  if (!slug) {
    return {
      title: "Restaurant Not Found | BiteSite",
      description: "The restaurant you are looking for could not be found.",
    };
  }
  const merchant = await getMerchantBySlug(slug);
  if (!merchant) {
    return {
      title: "Restaurant Not Found | BiteSite",
      description: "The restaurant you are looking for could not be found.",
    };
  }
  
  if (merchant.status === 'inactive' || ['TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED'].includes(merchant.business_status || '')) {
    return {
      title: `${merchant.name} — Currently Unavailable | BiteSite`,
      description: `We're sorry, but ${merchant.name} is not taking orders or reservations at the moment.`,
      robots: { index: false, follow: true },
    };
  }

  const description = merchant.description
    ? merchant.description.length > 155
      ? merchant.description.slice(0, 155) + "..."
      : merchant.description
    : `View the full menu, photos and opening hours for ${merchant.name} on BiteSite.`;
  const ogImage = merchant.cover_image
    ? merchant.cover_image.startsWith("http")
      ? merchant.cover_image
      : `${siteUrl}${merchant.cover_image}`
    : null;
  const canonicalUrl = `${siteUrl}/store/${merchant.slug}`;
  return {
    title: `${merchant.name} | ${merchant.cuisine_type ?? "Restaurant"} Menu | BiteSite`,
    description,
    keywords: [
      merchant.name,
      merchant.cuisine_type ?? "restaurant",
      "menu",
      "restaurant",
      "cafe",
      "Malaysia restaurants",
    ],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${merchant.name} — ${merchant.cuisine_type ?? "Restaurant"}`,
      description: merchant.description || `Menu & opening hours for ${merchant.name}`,
      images: ogImage ? [{ url: ogImage }] : [],
      type: "website",
      locale: "en_MY",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: merchant.name,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function MerchantPage({ params }: PageProps) {
  const siteUrl = getSiteUrl();
  const { merchant: slug } = await params;
  if (!slug) notFound();

  const [settings, merchant] = await Promise.all([
    getSettings(),
    getMerchantBySlug(slug),
  ]);

  if (!merchant) notFound();

  // Inactive merchant friendly page
  if (merchant.status === 'inactive' || ['TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED'].includes(merchant.business_status || '')) {
    const relatedMerchants = await getRelatedMerchants(
      merchant.slug,
      merchant.cuisine_type,
      merchant.tags,
      merchant.area,
      3
    );

    return (
      <>
        <PageViewTracker pageType="merchant" slug={merchant.slug} />
        <div className="min-h-screen bg-[#FAFBF7] flex flex-col">
          <div className="flex-1 flex items-center justify-center px-4 py-20">
            <div className="max-w-md w-full text-center">
              <div className="mb-6 text-6xl">😔</div>
              <h1 className="text-2xl font-bold text-[#2C3E2D] mb-3">
                This Restaurant is Unavailable
              </h1>
              <p className="text-[#6B6560] mb-2">
                We&apos;re sorry, but <strong>{merchant.name}</strong> is not taking orders
              </p>
              <p className="text-[#6B6560] mb-8">
                or reservations at the moment.
              </p>
              {relatedMerchants.length > 0 && (
                <div className="border-t border-[#DDE5DC] pt-8">
                  <p className="text-sm font-medium text-[#8A968B] mb-4">
                    Explore Other Great Restaurants
                  </p>
                  <div className="space-y-3">
                    {relatedMerchants.map((m) => (
                      <Link
                        key={m.slug}
                        href={`/store/${m.slug}`}
                        className="block p-4 bg-white rounded-xl border border-[#DDE5DC] hover:border-[#5A8F6E] transition-colors text-left"
                      >
                        <h3 className="font-semibold text-[#2C3E2D]">{m.name}</h3>
                        <p className="text-sm text-[#8A968B]">{m.cuisine_type}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-8">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-[#5A8F6E] font-medium hover:text-[#4A7A5E] transition-colors"
                >
                  ← Back to BiteSite
                </Link>
              </div>
            </div>
          </div>
          <footer className="py-8 px-4 text-center border-t border-[#DDE5DC]">
            <Link
              href="/"
              className="text-sm text-[#8A968B] hover:text-[#5A8F6E] transition-colors"
            >
              {settings.footer_text}
            </Link>
          </footer>
        </div>
      </>
    );
  }

  const [categories, products, videos, relatedMerchants, events, externalLinksRes] = await Promise.all([
    getCategoriesByMerchant(merchant.id),
    getProductsByMerchant(merchant.id),
    getVideosByMerchant(merchant.id),
    getRelatedMerchants(merchant.slug, merchant.cuisine_type, merchant.tags, merchant.area, 3),
    getEventsByMerchant(merchant.id),
    supabase.from("merchant_external_links").select("url").eq("merchant_id", merchant.id).eq("link_type", "grabfood").eq("is_active", true).maybeSingle(),
  ]);

  // Unknown, blank or not-yet-public-ready layout values render Classic instead of 404ing
  // the storefront. A null value is the ordinary default and stays silent; anything else is
  // bad data worth a server warning (sanitised: it comes from the database unvalidated).
  const { key: layoutKey, reason: layoutReason } = resolvePublicLayoutKey(merchant.layout);
  if (layoutReason !== "ok" && layoutReason !== "missing") {
    console.warn("[layout] invalid merchants.layout; rendering classic", {
      merchantId: merchant.id,
      reason: layoutReason,
      layoutValue: describeLayoutValueForLog(merchant.layout),
    });
  }
  const LayoutComponent = layouts[layoutKey];
  // Legacy merchants.reviews entries are not verified customer reviews. They are removed at the
  // server → client boundary so their text is not serialised into the page payload at all.
  const publicMerchant = withoutLegacyReviews(merchant);
  const publicRelatedMerchants = relatedMerchants.map(withoutLegacyReviews);

  const canonicalUrl = `${siteUrl}/store/${merchant.slug}`;
  const dayMap: Record<string, string> = {
    monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th",
    friday: "Fr", saturday: "Sa", sunday: "Su",
  };
  const schemaData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: merchant.name,
    image: merchant.cover_image,
    description: merchant.description,
    priceRange: "$$",
    url: canonicalUrl,
  };
  if (merchant.address) {
    schemaData.address = {
      "@type": "PostalAddress",
      streetAddress: merchant.address,
      ...(merchant.area ? { addressLocality: merchant.area } : {}),
      addressCountry: "MY",
    };
  }
  if (merchant.phone) schemaData.telephone = merchant.phone;
  if (merchant.cuisine_type) schemaData.servesCuisine = merchant.cuisine_type;
  
  schemaData.hasMenu = {
    "@type": "Menu",
    name: "Menu",
    url: `${canonicalUrl}#menu-section`,
  };
  
  if (merchant.operating_hours && typeof merchant.operating_hours === "object") {
    schemaData.openingHours = Object.entries(merchant.operating_hours).map(
      ([day, time]) => `${dayMap[day] || day} ${time}`
    );
  }
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: merchant.name, item: canonicalUrl },
    ],
  };

  return (
    <>
      <PageViewTracker pageType="merchant" slug={merchant.slug} />
      <ViewTracker slug={merchant.slug} />
      {externalLinksRes.data?.url && <GrabFoodOrderButton url={externalLinksRes.data.url} slug={merchant.slug} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schemaData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }} />
      <LayoutComponent
        merchant={publicMerchant}
        categories={categories}
        products={products}
        videos={videos}
        features={merchant.features}
        events={events}
        footerText={settings.footer_text}
      />
      <RelatedMerchants merchants={publicRelatedMerchants} variant={layoutKey} />
    </>
  );
}
