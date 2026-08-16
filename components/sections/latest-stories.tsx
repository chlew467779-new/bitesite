/* bitesite/components/sections/latest-stories.tsx */

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";

export async function LatestStories() {
  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(3);

  if (!articles || articles.length === 0) return null;

  return (
    <section className="border-t border-[#DDE5DC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-medium text-[#2C3E2D]">
              Latest Stories
            </h2>
            <Link
              href="/stories"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#5A8F6E] transition-colors hover:text-[#4A7A5E]"
            >
              View All
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </FadeIn>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, index) => (
            <FadeIn key={article.id} delay={index * 0.1} direction="up">
              <Link href={`/stories/${article.slug}`} className="group block">
                <article className="overflow-hidden rounded-xl border border-[#DDE5DC] bg-white transition-shadow duration-300 hover:shadow-md">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    {article.cover_image ? (
                      <SafeImage
                        src={article.cover_image}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="h-full w-full bg-[#F0F4EC]" />
                    )}
                  </div>
                  <div className="p-4">
                    <span className="mb-1 inline-block rounded-full bg-[#5A8F6E]/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#5A8F6E]">
                      {article.category}
                    </span>
                    <h3 className="font-serif text-base font-medium text-[#2C3E2D] transition-colors group-hover:text-[#5A8F6E] line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#8A968B]">
                      {new Date(article.created_at).toLocaleDateString("en-MY", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </article>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
