/* bitesite/app/store/[merchant]/page.tsx */

import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getMerchantBySlug,
  getCategoriesByMerchant,
  getProductsByMerchant,
  getVideosByMerchant,
  getPublishedMerchants,
  getRelatedMerchants,
  getEventsByMerchant,
  getRenamedMerchantSlug,
} from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { layouts } from "@/app/layouts";
import { describeLayoutValueForLog, resolvePublicLayoutKey } from "@/lib/layout-registry.mjs";
import { ViewTracker } from "@/components/sections/view-tracker";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { DeliveryOrderButtons } from "@/components/sections/delivery-order-buttons";
import { HiringSection } from "@/components/sections/hiring-section";
import { NearbyRestaurants } from "@/components/sections/nearby-restaurants";
import { nearbyOtherRestaurants } from "@/lib/nearby-core.mjs";
import { getRestaurantJobs } from "@/lib/jobs-public";
import { DELIVERY_LINK_TYPES } from "@/lib/merchant-links-core.mjs";
import { getSiteUrl } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/safe-json-ld.mjs";
import { discoveryPath, discoverySlug, merchantArea, merchantCuisines } from "@/lib/discovery-core.mjs";
import { ReportProblem } from "@/app/components/report-problem";
import { ClosedStore } from "@/components/store/closed-store";
import { DiscoveryLinks, StoreFooterLinks } from "@/components/store/store-footer";
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
  // The preview image is the generated share card (opengraph-image.tsx, PNG): covers are WebP,
  // which WhatsApp and other link previews do not always show.
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
      merchant.currency === "SGD" ? "Singapore restaurants" : "Malaysia restaurants",
    ],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${merchant.name} — ${merchant.cuisine_type ?? "Restaurant"}`,
      description: merchant.description || `Menu & opening hours for ${merchant.name}`,
      type: "website",
      locale: merchant.currency === "SGD" ? "en_SG" : "en_MY",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: merchant.name,
      description,
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

  if (!merchant) {
    // A renamed restaurant: send old links to the current address (permanent redirect).
    const renamed = await getRenamedMerchantSlug(slug);
    if (renamed) permanentRedirect(`/store/${encodeURIComponent(renamed)}`);
    notFound();
  }

  // Inactive merchant friendly page
  if (merchant.status === 'inactive' || ['TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED'].includes(merchant.business_status || '')) {
    const relatedMerchants = await getRelatedMerchants(
      merchant.slug,
      merchant.cuisine_type,
      merchant.tags,
      merchant.area,
      3
    );
    const temporarilyClosed = merchant.business_status === "TEMPORARILY_CLOSED";
    const { data: closure } = temporarilyClosed
      ? await supabase.from("merchant_closure_notices").select("note, reopen_on").eq("merchant_id", merchant.id).maybeSingle()
      : { data: null };

    return (
      <>
        <PageViewTracker pageType="merchant" slug={merchant.slug} />
        <ClosedStore
          merchant={{ slug: merchant.slug, name: merchant.name }}
          temporarilyClosed={temporarilyClosed}
          closure={closure}
          relatedMerchants={relatedMerchants.map(({ slug, name, cuisine_type, area, cover_image }) => ({ slug, name, cuisine_type, area: area ?? null, cover_image: cover_image ?? null }))}
        />
      </>
    );
  }

  const [categories, products, videos, relatedMerchants, events, externalLinksRes, jobs, publicMerchants] = await Promise.all([
    getCategoriesByMerchant(merchant.id),
    getProductsByMerchant(merchant.id),
    getVideosByMerchant(merchant.id),
    getRelatedMerchants(merchant.slug, merchant.cuisine_type, merchant.tags, merchant.area, 3),
    getEventsByMerchant(merchant.id),
    supabase.from("merchant_external_links").select("link_type, url").eq("merchant_id", merchant.id).in("link_type", [...DELIVERY_LINK_TYPES]).eq("is_active", true),
    getRestaurantJobs(merchant.id),
    // G19 "Nearby restaurants": public rows only (RLS + public projection); a failure just hides it.
    merchant.latitude != null && merchant.longitude != null ? getPublishedMerchants().catch(() => []) : Promise.resolve([]),
  ]);
  const nearby = nearbyOtherRestaurants(merchant, publicMerchants).map(({ merchant: m, distanceKm }) => ({
    slug: m.slug, name: m.name, cuisine: merchantCuisines(m)[0] ?? null, distanceKm, image: m.cover_image ?? null,
  }));

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
  // Same compact list as "Nearby restaurants"; a place already listed there is not repeated.
  const related = publicRelatedMerchants
    .filter((m) => !nearby.some((n) => n.slug === m.slug))
    .map((m) => ({ slug: m.slug, name: m.name, cuisine: merchantCuisines(m)[0] ?? null, image: m.cover_image ?? null }));

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
      // Singapore restaurants price in S$ (#24); the price currency stands for the country here.
      addressCountry: merchant.currency === "SGD" ? "SG" : "MY",
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
      >
        <HiringSection jobs={jobs} />
        <NearbyRestaurants items={nearby} />
        <NearbyRestaurants titleKey="store.related" headingId="related-heading" items={related} />
        <DiscoveryLinks area={merchantArea(merchant)} cuisines={merchantCuisines(merchant)} />
        <footer className="mx-auto mt-8 flex max-w-5xl flex-col items-start gap-1 border-t border-line px-4 pb-8 pt-4">
          <ReportProblem targetType="merchant" slug={merchant.slug} className="w-full" />
          <StoreFooterLinks footerText={settings.footer_text} />
        </footer>
        {/* Last, so its spacer keeps the fixed order bar from covering the footer. */}
        <DeliveryOrderButtons links={externalLinksRes.data ?? []} slug={merchant.slug} />
      </LayoutComponent>
    </>
  );
}
