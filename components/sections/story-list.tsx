/* bitesite/components/sections/story-list.tsx */

import { StoryCard } from "./story-card";
import type { Article } from "@/types";

interface StoryListProps {
  articles: Article[];
}

export function StoryList({ articles }: StoryListProps) {
  if (articles.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-medium text-[#2C3E2D]">No stories found</p>
        <p className="mt-2 text-sm text-[#8A968B]">
          Check back later for new articles.
        </p>
      </div>
    );
  }

  const [featured, ...rest] = articles;

  return (
    <div className="space-y-6">
      {/* Featured Article */}
      {featured && <StoryCard article={featured} featured />}

      {/* Article List */}
      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((article) => (
            <StoryCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
