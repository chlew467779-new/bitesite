/* bitesite/components/sections/latest-stories.tsx */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SafeImage } from "@/app/components/safe-image";
import { SectionTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { PublicArticle } from "@/types";
import { PUBLIC_ARTICLE_SELECT } from "@/lib/public-article-projection.mjs";
import { useLang, useT } from "@/lib/i18n";

const DATE_LOCALES = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" } as const;

/** Home page "Stories": the three newest, as a compact list (photo left, text right). */
export function LatestStories() {
  const t = useT();
  const lang = useLang();
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArticles() {
      const { data } = await supabase
        .from("articles")
        .select(PUBLIC_ARTICLE_SELECT)
        .order("created_at", { ascending: false })
        .limit(3)
        .returns<PublicArticle[]>();

      setArticles(data || []);
      setLoading(false);
    }

    fetchArticles();
  }, []);

  if (!loading && articles.length === 0) return null;

  return (
    <section aria-labelledby="stories-heading" className="mx-auto max-w-6xl px-4 pt-8">
      <div className="flex items-center justify-between">
        <SectionTitle id="stories-heading">{t("nav.stories")}</SectionTitle>
        <Link href="/stories" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">
          {t("home.allStories")}
        </Link>
      </div>
      <ul className="mt-2 grid gap-4 md:grid-cols-3">
        {loading
          ? [1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3.5" aria-hidden>
                <span className="size-24 shrink-0 animate-pulse rounded-2xl bg-surface" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-20 animate-pulse rounded bg-surface" />
                  <span className="block h-4 w-4/5 animate-pulse rounded bg-surface" />
                </span>
              </li>
            ))
          : articles.map((article) => (
              <li key={article.id}>
                <Link href={`/stories/${article.slug}`} className="group flex items-center gap-3.5 text-ink">
                  <span className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-surface">
                    {article.cover_image && (
                      <SafeImage src={article.cover_image} alt="" fill sizes="96px" className="object-cover" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    {article.category && (
                      <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#8A5A12]">{article.category}</span>
                    )}
                    <span className="line-clamp-2 text-base font-bold leading-snug group-hover:text-brand">{article.title}</span>
                    <span className="text-[13px] text-muted">
                      {new Date(article.created_at).toLocaleDateString(DATE_LOCALES[lang], { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
