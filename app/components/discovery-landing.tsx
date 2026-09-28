/* bitesite/app/components/discovery-landing.tsx */

/**
 * Area and cuisine landing pages (server). Public restaurants only (row level security), grouped
 * by lib/discovery-core. Unknown groups 404; non-canonical slugs redirect permanently; groups with
 * fewer than two restaurants render but are not indexed. Links to the other indexable areas and
 * cuisines give crawlers and visitors a way through the site.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { MerchantCard } from '@/components/sections/merchant-card';
import { PageViewTracker } from '@/app/components/page-view-tracker';
import { getPublishedMerchants } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/site-url';
import { safeJsonLd } from '@/lib/safe-json-ld.mjs';
import { discoveryCopy, discoveryGroups, discoveryLanding, discoveryPath, discoverySlug, type DiscoveryKind } from '@/lib/discovery-core.mjs';

async function load(kind: DiscoveryKind, rawSlug: string) {
  const slug = decodeURIComponent(rawSlug);
  const canonical = discoverySlug(slug);
  if (!canonical) notFound();
  if (canonical !== slug) permanentRedirect(discoveryPath(kind, canonical));
  const merchants = await getPublishedMerchants();
  const landing = discoveryLanding(kind, canonical, merchants);
  if (!landing) notFound();
  return { landing, merchants };
}

export async function discoveryMetadata(kind: DiscoveryKind, rawSlug: string): Promise<Metadata> {
  const slug = discoverySlug(decodeURIComponent(rawSlug));
  const merchants = await getPublishedMerchants();
  const landing = slug ? discoveryLanding(kind, slug, merchants) : null;
  if (!landing) return { title: 'Not Found | BiteSite', robots: { index: false, follow: true } };
  const copy = discoveryCopy(kind, landing.label, landing.merchants.length);
  const url = `${getSiteUrl()}${discoveryPath(kind, landing.slug)}`;
  return {
    title: `${copy.title} | BiteSite`,
    description: copy.description,
    alternates: { canonical: url },
    openGraph: { title: `${copy.title} | BiteSite`, description: copy.description, url, type: 'website' },
    robots: landing.indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export async function DiscoveryLandingPage({ kind, slug: rawSlug }: { kind: DiscoveryKind; slug: string }) {
  const { landing, merchants } = await load(kind, rawSlug);
  const siteUrl = getSiteUrl();
  const copy = discoveryCopy(kind, landing.label, landing.merchants.length);
  const pageUrl = `${siteUrl}${discoveryPath(kind, landing.slug)}`;
  const otherAreas = discoveryGroups('area', merchants).filter((g) => g.indexable && !(kind === 'area' && g.slug === landing.slug)).slice(0, 12);
  const otherCuisines = discoveryGroups('cuisine', merchants).filter((g) => g.indexable && !(kind === 'cuisine' && g.slug === landing.slug)).slice(0, 12);

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: copy.title,
    url: pageUrl,
    numberOfItems: landing.merchants.length,
    itemListElement: landing.merchants.map((m, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}/store/${m.slug}`, name: m.name })),
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: copy.title, item: pageUrl },
    ],
  };

  return (
    <main className="min-h-screen bg-[#FAFBF7]">
      <PageViewTracker pageType="discovery" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbs) }} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-[#6B6560]">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[#2C3E2D]">{copy.title}</li>
          </ol>
        </nav>
        <h1 className="mt-2 font-serif text-3xl text-[#2C3E2D] sm:text-4xl">{copy.heading}</h1>
        <p className="mt-2 max-w-2xl text-[#6B6560]">{copy.description}</p>

        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {landing.merchants.map((merchant) => <li key={merchant.id}><MerchantCard merchant={merchant} /></li>)}
        </ul>

        {(otherAreas.length > 0 || otherCuisines.length > 0) && (
          <section aria-labelledby="explore-more" className="mt-12 border-t border-[#DDE5DC] pt-8">
            <h2 id="explore-more" className="font-serif text-2xl text-[#2C3E2D]">Explore more</h2>
            {otherAreas.length > 0 && <ChipList title="Areas" kind="area" groups={otherAreas} />}
            {otherCuisines.length > 0 && <ChipList title="Cuisines" kind="cuisine" groups={otherCuisines} />}
          </section>
        )}
      </div>
    </main>
  );
}

function ChipList({ title, kind, groups }: { title: string; kind: DiscoveryKind; groups: { slug: string; label: string; count: number }[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-[#6B6560]">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {groups.map((g) => (
          <li key={g.slug}>
            <Link href={discoveryPath(kind, g.slug)} className="inline-flex min-h-11 items-center rounded-full border border-[#C9D6C7] bg-white px-4 text-sm text-[#2C3E2D] hover:border-emerald-700">
              {g.label} <span className="ml-1.5 text-xs text-[#6B6560]">{g.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
