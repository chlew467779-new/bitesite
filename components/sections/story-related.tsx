/* bitesite/components/sections/story-related.tsx */

import { StoryRelatedHeading } from "./story-detail-text";
import { StoryCard } from "./story-card";
import { supabase } from "@/lib/supabase";
import { PUBLIC_ARTICLE_SELECT } from "@/lib/public-article-projection.mjs";
import type { PublicArticle } from "@/types";

interface StoryRelatedProps {
  currentSlug: string;
  category: string;
}

export async function StoryRelated({ currentSlug, category }: StoryRelatedProps) {
  const { data: related } = await supabase
    .from("articles")
    .select(PUBLIC_ARTICLE_SELECT)
    .eq("category", category)
    .neq("slug", currentSlug)
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<PublicArticle[]>();

  let articles = related || [];
  if (articles.length === 0) {
    const { data: fallback } = await supabase
      .from("articles")
      .select(PUBLIC_ARTICLE_SELECT)
      .neq("slug", currentSlug)
      .order("created_at", { ascending: false })
      .limit(3)
      .returns<PublicArticle[]>();
    articles = fallback || [];
  }

  if (articles.length === 0) return null;

  // Always on the site's white page, whatever the Story's own colour theme, so the rows read the same everywhere.
  return (
    <section className="border-t border-line bg-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-xl font-extrabold tracking-[-0.02em] text-ink">
          <StoryRelatedHeading />
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <li key={article.id}><StoryCard article={article} /></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
