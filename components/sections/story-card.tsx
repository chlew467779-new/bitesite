/* bitesite/components/sections/story-card.tsx */

import Link from "next/link";
import { SafeImage } from "@/app/components/safe-image";
import type { Article } from "@/types";

interface StoryCardProps {
  article: Article;
  featured?: boolean;
}

export function StoryCard({ article, featured = false }: StoryCardProps) {
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

  if (featured) {
    return (
      <Link href={`/stories/${article.slug}`} className="group block">
        <article className="overflow-hidden rounded-2xl border border-[#DDE5DC] bg-white transition-shadow duration-300 hover:shadow-lg">
          <div className="relative aspect-[16/9] overflow-hidden">
            {article.cover_image ? (
              <SafeImage
                src={article.cover_image}
                alt={article.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 896px"
              />
            ) : (
              <div className="h-full w-full bg-[#F0F4EC]" />
            )}
          </div>
          <div className="p-6">
            <span className="mb-2 inline-block rounded-full bg-[#5A8F6E]/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#5A8F6E]">
              {article.category}
            </span>
            <h3 className="mb-2 font-serif text-xl font-medium text-[#2C3E2D] transition-colors group-hover:text-[#5A8F6E]">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="mb-4 text-sm leading-relaxed text-[#6B6560] line-clamp-2">
                {article.excerpt}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-[#8A968B]">
              <span>{formattedDate}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {viewCount}
              </span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link href={`/stories/${article.slug}`} className="group block">
      <article className="flex gap-4 overflow-hidden rounded-xl border border-[#DDE5DC] bg-white p-4 transition-shadow duration-300 hover:shadow-md">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
          {article.cover_image ? (
            <SafeImage
              src={article.cover_image}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="96px"
            />
          ) : (
            <div className="h-full w-full bg-[#F0F4EC]" />
          )}
        </div>
        <div className="flex flex-col justify-center">
          <span className="mb-1 inline-block w-fit rounded-full bg-[#5A8F6E]/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#5A8F6E]">
            {article.category}
          </span>
          <h3 className="mb-1 font-serif text-base font-medium text-[#2C3E2D] transition-colors group-hover:text-[#5A8F6E] line-clamp-2">
            {article.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-[#8A968B]">
            <span>{formattedDate}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {viewCount}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
