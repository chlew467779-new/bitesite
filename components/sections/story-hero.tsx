/* bitesite/components/sections/story-hero.tsx */

import { SafeImage } from "@/app/components/safe-image";
import type { Article } from "@/types";

interface StoryHeroProps {
  article: Article;
}

export function StoryHero({ article }: StoryHeroProps) {
  const formattedDate = new Date(article.created_at).toLocaleDateString(
    "en-MY",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  const viewCount =
    article.view_count >= 1000
      ? `${(article.view_count / 1000).toFixed(1)}k`
      : `${article.view_count}`;

  return (
    <section className="px-4 pt-8 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Category & Tags */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#5A8F6E]/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#5A8F6E]">
            {article.category}
          </span>
          {article.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#DDE5DC] bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#8A968B]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="mb-4 font-serif text-3xl font-medium leading-tight text-[#2C3E2D] sm:text-4xl md:text-5xl">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-[#8A968B]">
          <span className="font-medium text-[#6B6560]">{article.author}</span>
          <span>·</span>
          <span>{formattedDate}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {viewCount} views
          </span>
        </div>

        {/* Cover Image */}
        {article.cover_image && (
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
            <SafeImage
              src={article.cover_image}
              alt={article.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}
      </div>
    </section>
  );
}
