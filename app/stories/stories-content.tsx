"use client";

import { useEffect, useMemo, useState } from "react";
import { StoryFilter } from "@/components/sections/story-filter";
import { StoryList } from "@/components/sections/story-list";
import type { Article } from "@/types";

export function StoriesContent({ articles }: { articles: Article[] }) {
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

  return (
    <>
      <div className="mx-auto max-w-4xl px-4">
        <StoryFilter
          categories={categories}
          activeCategory={selectedCategory}
          onCategoryChange={setActiveCategory}
        />
        <p className="pb-2 text-xs text-[#8A968B]" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "story" : "stories"}
          {selectedCategory ? ` in ${selectedCategory}` : ""}
        </p>
      </div>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
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
