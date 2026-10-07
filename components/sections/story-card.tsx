/* bitesite/components/sections/story-card.tsx */

"use client";

import Link from "next/link";
import { SafeImage } from "@/app/components/safe-image";
import { useLang } from "@/lib/i18n";
import type { PublicArticle } from "@/types";

const DATE_LOCALES = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" } as const;

interface StoryCardProps {
  article: PublicArticle;
  featured?: boolean;
}

/** Story in the list (R10): the newest one large, the rest as photo-left rows like the home page. */
export function StoryCard({ article, featured = false }: StoryCardProps) {
  const lang = useLang();
  const date = new Date(article.created_at).toLocaleDateString(DATE_LOCALES[lang], { day: "numeric", month: "short", year: "numeric" });

  if (featured) {
    return (
      <Link href={`/stories/${article.slug}`} className="group flex flex-col gap-3 text-ink">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] bg-surface">
          {article.cover_image && (
            <SafeImage src={article.cover_image} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" sizes="(max-width: 1024px) 100vw, 896px" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {article.category && <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#8A5A12]">{article.category}</span>}
          <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] group-hover:text-brand">{article.title}</h2>
          {article.excerpt && <p className="line-clamp-2 text-[15px] leading-normal text-ink-2">{article.excerpt}</p>}
          <span className="text-[13px] text-muted">{date}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/stories/${article.slug}`} className="group flex items-center gap-3.5 text-ink">
      <span className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-surface">
        {article.cover_image && <SafeImage src={article.cover_image} alt="" fill className="object-cover" sizes="96px" />}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        {article.category && <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#8A5A12]">{article.category}</span>}
        <span className="line-clamp-2 text-base font-bold leading-snug group-hover:text-brand">{article.title}</span>
        <span className="text-[13px] text-muted">{date}</span>
      </span>
    </Link>
  );
}
