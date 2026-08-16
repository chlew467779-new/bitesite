/* bitesite/app/stories/page.tsx */

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { StoryFilter } from "@/components/sections/story-filter";
import { StoryList } from "@/components/sections/story-list";
import { Footer } from "@/components/sections/footer";
import { FadeIn } from "@/app/components/animations";
import type { Article } from "@/types";

export default function StoriesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from("articles")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });

      const allArticles = data || [];
      const cats = Array.from(new Set(allArticles.map((a) => a.category))).sort();

      setArticles(allArticles);
      setCategories(cats);
      setLoading(false);
    }

    fetchData();
  }, []);

  const filtered = activeCategory
    ? articles.filter((a) => a.category === activeCategory)
    : articles;

  return (
    <main style={{ backgroundColor: "#FAFBF7" }}>
      {/* Hero */}
      <section className="px-4 py-16 text-center sm:px-6 lg:px-8">
        <FadeIn direction="up" duration={0.6}>
          <h1 className="mb-4 font-serif text-3xl font-medium tracking-tight text-[#2C3E2D] sm:text-4xl md:text-5xl">
            Stories
          </h1>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-[#6B6560] md:text-lg">
            Discover local restaurants, new openings & hidden gems
          </p>
        </FadeIn>
      </section>

      {/* Filter */}
      <div className="mx-auto max-w-4xl px-4">
        <StoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Article List */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-[#DDE5DC] bg-white"
                >
                  <div className="aspect-[16/9] animate-pulse bg-gray-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-16 animate-pulse rounded-full bg-gray-100" />
                    <div className="h-5 w-3/4 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StoryList articles={filtered} />
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
