import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// 直接在 sitemap 里创建 client（不需要 cookie）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: merchants } = await supabase
    .from("merchants")
    .select("slug, updated_at")
    .eq("is_published", true);

  const merchantUrls = (merchants || []).map((m) => ({
    url: `https://bitesite-pied.vercel.app/store/${m.slug}`,
    lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: "https://bitesite-pied.vercel.app",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...merchantUrls,
  ];
}
