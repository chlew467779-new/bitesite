"use client";

import { useEffect, useMemo, useState } from "react";
import { StoryFilter } from "@/components/sections/story-filter";
import { StoryList } from "@/components/sections/story-list";
import type { PublicArticle } from "@/types";
import { useT } from "@/lib/i18n";

export function StoriesContent({ articles }: { articles: PublicArticle[] }) {
  const t = useT();
  const [activeCategory, setActiveCategory] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("category");
  });
  const categories = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category)))
      .filter((category): category is string => Boolean(category))
      .sort(),
    [articles]
  );
  const selectedCategory = activeCategory && categories.includes(activeCategory)
    ? activeCategory
    : null;
  const filtered = selectedCategory
    ? articles.filter((article) => article.category === selectedCategory)
    : articles;

  useEffect(() => {
    const onPopState = () => {
      setActiveCategory(new URLSearchParams(window.location.search).get("category"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategory) params.set("category", selectedCategory);
    else params.delete("category");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [selectedCategory]);

  const countText = t(filtered.length === 1 ? "stories.countOne" : "stories.count", { count: filtered.length });

  return (
    <>
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="pt-5 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] md:pt-10 md:text-[40px]">{t("stories.title")}</h1>
        <p className="mt-2 max-w-xl text-[15px] text-ink-2">{t("stories.intro")}</p>
        <StoryFilter
          categories={categories}
          activeCategory={selectedCategory}
          onCategoryChange={setActiveCategory}
        />
        <p className="pb-2 text-sm text-muted" aria-live="polite">
          {selectedCategory ? `${selectedCategory} · ${countText}` : countText}
        </p>
      </div>

      <section className="px-4 pb-4 pt-3">
        <div className="mx-auto max-w-4xl">
          <StoryList
            articles={filtered}
            onClearFilter={selectedCategory ? () => setActiveCategory(null) : undefined}
          />
        </div>
      </section>
    </>
  );
}
