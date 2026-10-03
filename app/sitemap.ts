/* bitesite/app/sitemap.ts */

import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/site-url";
import { PUBLIC_MERCHANT_SELECT } from "@/lib/public-merchant-projection.mjs";
import { discoveryGroups, discoveryPath, type DiscoveryKind } from "@/lib/discovery-core.mjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bitesite-pied.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  // Row level security returns only public merchants; is_published is not a public column.
  const { data: merchants } = await supabase
    .from("merchants")
    .select("slug, updated_at");

  const merchantUrls = (merchants || []).map((m) => ({
    url: `${siteUrl}/store/${m.slug}`,
    lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  // Area and cuisine landing pages with at least two public restaurants (no thin pages).
  const { data: listed } = await supabase.from("merchants").select(PUBLIC_MERCHANT_SELECT);
  const landingUrls = (['area', 'cuisine'] as DiscoveryKind[]).flatMap((kind) =>
    discoveryGroups(kind, (listed ?? []) as { area?: string | null; cuisine?: string[] | null; cuisine_type?: string | null }[])
      .filter((group) => group.indexable)
      .map((group) => ({ url: `${siteUrl}${discoveryPath(kind, group.slug)}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 })));
  // Row level security (private.article_is_public) returns only public Stories.
  const { data: stories } = await supabase
    .from('articles')
    .select('slug, updated_at');
  const storyUrls = (stories || []).map((story) => ({
    url: `${siteUrl}/stories/${story.slug}`,
    lastModified: story.updated_at ? new Date(story.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    { url: `${siteUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/feedback`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...merchantUrls,
    ...landingUrls,
    ...storyUrls,
  ];
}
