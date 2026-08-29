/* bitesite/app/stories/[slug]/page.tsx */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StoryHero } from "@/components/sections/story-hero";
import { StoryContent } from "@/components/sections/story-content";
import { StoryRelated } from "@/components/sections/story-related";
import { StoryViewTracker } from "@/components/sections/story-view-tracker";
import { StoryMerchantLink } from "@/components/sections/story-merchant-link";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { Footer } from "@/components/sections/footer";
import type { Article } from "@/types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

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
      <PageViewTracker pageType="story" slug={slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <main style={{ backgroundColor: "#FAFBF7" }}>
        <StoryViewTracker slug={slug} />
        <StoryHero article={article as Article} />
        <StoryContent content={article.content} articleSlug={slug} />

        {article.merchant_slug && (
          <StoryMerchantLink slug={article.merchant_slug} />
        )}

        <StoryRelated currentSlug={slug} category={article.category} />
        <Footer />
      </main>
    </>
  );
}
