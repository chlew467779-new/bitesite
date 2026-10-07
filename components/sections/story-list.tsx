/* bitesite/components/sections/story-list.tsx */

"use client";

import { StoryCard } from "./story-card";
import { buttonClasses } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { PublicArticle } from "@/types";

interface StoryListProps {
  articles: PublicArticle[];
  onClearFilter?: () => void;
}

export function StoryList({ articles, onClearFilter }: StoryListProps) {
  const t = useT();
  if (articles.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface p-8 text-center">
        <p className="text-lg font-bold">{t("stories.empty.title")}</p>
        <p className="mt-2 text-sm text-muted">{onClearFilter ? t("stories.empty.filtered") : t("stories.empty.all")}</p>
        {onClearFilter && (
          <button type="button" onClick={onClearFilter} className={`${buttonClasses({ variant: "secondary", size: "md" })} mt-4`}>
            {t("stories.clear")}
          </button>
        )}
      </div>
    );
  }

  const [featured, ...rest] = articles;

  return (
    <div className="space-y-6">
      {featured && <StoryCard article={featured} featured />}
      {rest.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {rest.map((article) => (
            <li key={article.id}><StoryCard article={article} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
