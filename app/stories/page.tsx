/* bitesite/app/stories/page.tsx */

import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { StoryFilter } from "@/components/sections/story-filter";
import { StoryList } from "@/components/sections/story-list";
import { Footer } from "@/components/sections/footer";
import { FadeIn } from "@/app/components/animations";

export const metadata: Metadata = {
  title: "Stories — Discover Local Restaurants & Hidden Gems",
  description:
    "Read the latest stories about new restaurant openings, promotions, and hidden gems in KL. BiteSite Stories.",
  openGraph: {
    title: "Stories — Discover Local Restaurants & Hidden Gems",
    description:
      "Read the latest stories about new restaurant openings, promotions, and hidden gems in KL.",
    type: "website",
  },
};

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  // Fetch distinct categories dynamically
  const { data: categoryData } = await supabase
    .from("articles")
    .select("category")
    .eq("published", true);

  const categories = Array.from(
    new Set(categoryData?.map((c) => c.category) || [])
  ).sort();

  // Fetch articles
  let query = supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data: articles } = await query;

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
          activeCategory={category || null}
        />
      </div>

      {/* Article List */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <StoryList articles={articles || []} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
