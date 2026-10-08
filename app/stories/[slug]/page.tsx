/* bitesite/app/stories/[slug]/page.tsx */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StoryExpiredNotice } from "@/components/sections/story-detail-text";
import { StoryHero } from "@/components/sections/story-hero";
import { StoryContent } from "@/components/sections/story-content";
import { StoryRelated } from "@/components/sections/story-related";
import { StoryViewTracker } from "@/components/sections/story-view-tracker";
import { StoryMerchantLink } from "@/components/sections/story-merchant-link";
import { PageViewTracker } from "@/app/components/page-view-tracker";
import { Footer } from "@/components/sections/footer";
import type { PublicArticle } from "@/types";
import { PUBLIC_ARTICLE_SELECT } from "@/lib/public-article-projection.mjs";
import { getSiteUrl } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/safe-json-ld.mjs";
import { ReportProblem } from "@/app/components/report-problem";
import { decodeStorySlugParam } from "@/lib/story-slug-core.mjs";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const { data: articles } = await supabase
    .from("articles")
    .select("slug")
    .returns<{ slug: string }[]>();

  return (articles || []).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  // Older Chinese slugs reach the page percent-encoded; the database stores them decoded.
  const slug = decodeStorySlugParam(rawSlug);
  const { data: article } = await supabase
    .from("articles")
    .select("title, excerpt, cover_image, category, tags")
    .eq("slug", slug)
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
  const keywords = [
    "restaurant",
    "Malaysia cafe",
    "Malaysia food",
    article.title,
    article.category,
    ...(article.tags || []),
  ];

  return {
    title: `${article.title} | BiteSite Stories`,
    description,
    keywords,
    openGraph: {
      title: article.title,
      description,
      // A Story without a cover uses the default BiteSite share card.
      images: ogImage ? [{ url: ogImage }] : ["/opengraph-image"],
      type: "article",
    },
  };
}

const bgColors: Record<string, string> = {
  default: '#FFFFFF',
  warm: '#FDF8F3',
  cool: '#F5F7FA',
  dark: '#1A1A1A',
  nature: '#F4F7F0',
  minimal: '#FFFFFF',
};

const hashtagColors: Record<string, { border: string; text: string }> = {
  default: { border: '#E3E7DF', text: '#5B655E' },
  warm: { border: '#E8DDD0', text: '#9A8B7D' },
  cool: { border: '#E2E8F0', text: '#718096' },
  dark: { border: '#333333', text: '#888888' },
  nature: { border: '#D0DDC8', text: '#7A8F7B' },
  minimal: { border: '#E5E5E5', text: '#888888' },
};

export default async function StoryPage({ params }: PageProps) {
  const siteUrl = getSiteUrl();
  const { slug: rawSlug } = await params;
  // Older Chinese slugs reach the page percent-encoded; the database stores them decoded.
  const slug = decodeStorySlugParam(rawSlug);

  const { data: article } = await supabase
    .from("articles")
    .select(PUBLIC_ARTICLE_SELECT)
    .eq("slug", slug)
    .returns<PublicArticle[]>()
    .single();

  if (!article) notFound();

  const theme = (article.background_style as string) || 'default';
  const bgColor = bgColors[theme] || bgColors.default;
  const hashColors = hashtagColors[theme] || hashtagColors.default;
  // Server-rendered pages intentionally evaluate promotion expiry at request time.
  // eslint-disable-next-line react-hooks/purity
  const isExpired = Boolean(article.end_at && new Date(article.end_at).getTime() < Date.now());

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
        url: `${siteUrl}/apple-icon`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/stories/${article.slug}`,
    },
  };

  return (
    <>
      <PageViewTracker pageType="story" slug={slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }} />
      <main style={{ backgroundColor: bgColor }}>
        <StoryViewTracker slug={slug} />
        {isExpired && <StoryExpiredNotice />}
        <StoryHero article={article} theme={theme} />
        <StoryContent content={article.content} articleSlug={slug} theme={theme} />

        {article.merchant_slug && (
          <StoryMerchantLink slug={article.merchant_slug} articleSlug={slug} />
        )}

        <StoryRelated currentSlug={slug} category={article.category} />

        {/* Hashtags */}
        {article.tags && article.tags.length > 0 && (
          <section className="px-4 py-6 sm:px-6 lg:px-8 border-t" style={{ borderColor: hashColors.border }}>
            <div className="mx-auto max-w-3xl">
              <p className="text-sm" style={{ color: hashColors.text }}>
                {article.tags.map((tag: string) => `#${tag.replace(/\s+/g, "")}`).join(" ")}
              </p>
            </div>
          </section>
        )}

        <ReportProblem targetType="story" slug={slug} />

        <Footer />
      </main>
    </>
  );
}
