"use client";

import { useMemo, useState } from "react";
import { StoryFilter } from "@/components/sections/story-filter";
import { StoryList } from "@/components/sections/story-list";
import type { Article } from "@/types";

export function StoriesContent({ articles }: { articles: Article[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categories = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category)))
      .filter((category): category is string => Boolean(category))
      .sort(),
    [articles]
  );
  const filtered = activeCategory
    ? articles.filter((article) => article.category === activeCategory)
    : articles;

  return (
    <>
      <div className="mx-auto max-w-4xl px-4">
        <StoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
        <p className="pb-2 text-xs text-[#8A968B]" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "story" : "stories"}
          {activeCategory ? ` in ${activeCategory}` : ""}
        </p>
      </div>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <StoryList
            articles={filtered}
            onClearFilter={activeCategory ? () => setActiveCategory(null) : undefined}
          />
        </div>
      </section>
    </>
  );
}
