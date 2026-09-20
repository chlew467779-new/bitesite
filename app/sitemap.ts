/* bitesite/app/sitemap.ts */

import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bitesite-pied.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: merchants } = await supabase
    .from("merchants")
    .select("slug, updated_at")
    .eq("is_published", true);

  const merchantUrls = (merchants || []).map((m) => ({
    url: `${SITE_URL}/store/${m.slug}`,
    lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const { data: stories } = await supabase
    .from('articles')
    .select('slug, updated_at')
    .eq('published', true)
    .eq('editorial_status', 'published');
  const storyUrls = (stories || []).map((story) => ({
    url: `${SITE_URL}/stories/${story.slug}`,
    lastModified: story.updated_at ? new Date(story.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...merchantUrls,
    ...storyUrls,
  ];
}
