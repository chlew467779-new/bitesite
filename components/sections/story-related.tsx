/* bitesite/components/sections/story-related.tsx */

import Link from "next/link";
import { SafeImage } from "@/app/components/safe-image";
import { supabase } from "@/lib/supabase";

interface StoryRelatedProps {
  currentSlug: string;
  category: string;
}

export async function StoryRelated({ currentSlug, category }: StoryRelatedProps) {
  const { data: related } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .eq("category", category)
    .neq("slug", currentSlug)
    .order("created_at", { ascending: false })
    .limit(3);

  let articles = related || [];
  if (articles.length === 0) {
    const { data: fallback } = await supabase
      .from("articles")
      .select("*")
      .eq("published", true)
      .neq("slug", currentSlug)
      .order("created_at", { ascending: false })
      .limit(3);
    articles = fallback || [];
  }

  if (articles.length === 0) return null;

  return (
    <section className="border-t border-[#DDE5DC] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 font-serif text-2xl font-medium text-[#2C3E2D]">
          More Stories
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/stories/${article.slug}`}
              className="group block"
            >
              <article className="overflow-hidden rounded-xl border border-[#DDE5DC] bg-white transition-shadow duration-300 hover:shadow-md">
                <div className="relative aspect-[4/3] overflow-hidden">
                  {article.cover_image ? (
                    <SafeImage
                      src={article.cover_image}
                      alt={article.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="h-full w-full bg-[#F0F4EC]" />
                  )}
                </div>
                <div className="p-4">
                  <span className="mb-1 inline-block rounded-full bg-[#5A8F6E]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#5A8F6E]">
                    {article.category}
                  </span>
                  <h3 className="font-serif text-sm font-medium text-[#2C3E2D] transition-colors group-hover:text-[#5A8F6E] line-clamp-2">
                    {article.title}
                  </h3>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
