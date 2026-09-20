import { Footer } from "@/components/sections/footer";
import { FadeIn } from "@/app/components/animations";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { StoriesContent } from "./stories-content";
import { supabase } from "@/lib/supabase";
import type { Article } from "@/types";

export const revalidate = 300;

export default async function StoriesPage() {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load Stories right now.");
  }

  return (
    <main style={{ backgroundColor: "#FAFBF7" }}>
      <PageViewTracker pageType="story_list" />
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

      <StoriesContent articles={(data || []) as Article[]} />
      <Footer />
    </main>
  );
}
