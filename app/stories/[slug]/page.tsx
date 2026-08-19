/* bitesite/app/stories/[slug]/page.tsx */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StoryHero } from "@/components/sections/story-hero";
import { StoryContent } from "@/components/sections/story-content";
import { StoryRelated } from "@/components/sections/story-related";
import { StoryViewTracker } from "@/components/sections/story-view-tracker";
import { Footer } from "@/components/sections/footer";
import type { Article } from "@/types";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const { data: articles } = await supabase
    .from("articles")
    .select("slug")
    .eq("published", true);

  return (articles || []).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: article } = await supabase
    .from("articles")
    .select("title, excerpt, cover_image")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!article) {
    return {
      title: "Story Not Found | BiteSite",
      description: "The story you are looking for could not be found.",
    };
  }

  const description =
    article.excerpt || `Read ${article.title} on BiteSite Stories.`;
  const ogImage = article.cover_image || undefined;

  return {
    title: `${article.title} | BiteSite Stories`,
    description,
    openGraph: {
      title: article.title,
      description,
      images: ogImage ? [{ url: ogImage }] : [],
      type: "article",
    },
  };
}

export default async function StoryPage({ params }: PageProps) {
  const { slug } = await params;

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!article) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt || `Read ${article.title} on BiteSite.`,
    image: article.cover_image ? [article.cover_image] : [],
    datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at,
    author: {
      "@type": "Organization",
      name: article.author || "BiteSite",
    },
    publisher: {
      "@type": "Organization",
      name: "BiteSite",
      logo: {
        "@type": "ImageObject",
        url: "https://bitesite-pied.vercel.app/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://bitesite-pied.vercel.app/stories/${article.slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <main style={{ backgroundColor: "#FAFBF7" }}>
        <StoryViewTracker slug={slug} />
        <StoryHero article={article as Article} />
        <StoryContent content={article.content} />

        {/* Merchant Link */}
        {article.merchant_slug && (
          <section className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <a
                href={`/store/${article.merchant_slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#5A8F6E] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Read more about this restaurant
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
              </a>
            </div>
          </section>
        )}

        <StoryRelated currentSlug={slug} category={article.category} />
        <Footer />
      </main>
    </>
  );
}
