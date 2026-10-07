import { Footer } from "@/components/sections/footer";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { StoriesContent } from "./stories-content";
import { supabase } from "@/lib/supabase";
import type { PublicArticle } from "@/types";
import { PUBLIC_ARTICLE_SELECT } from "@/lib/public-article-projection.mjs";

export const revalidate = 300;

export default async function StoriesPage() {
  const { data, error } = await supabase
    .from("articles")
    .select(PUBLIC_ARTICLE_SELECT)
    .order("created_at", { ascending: false })
    .returns<PublicArticle[]>();

  if (error) {
    throw new Error("Unable to load Stories right now.");
  }

  return (
    <main className="min-h-screen bg-page text-ink">
      <PageViewTracker pageType="story_list" />

      <StoriesContent articles={data || []} />
      <Footer />
    </main>
  );
}
