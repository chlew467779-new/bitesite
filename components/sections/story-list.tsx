/* bitesite/components/sections/story-list.tsx */

import { StoryCard } from "./story-card";
import type { Article } from "@/types";

interface StoryListProps {
  articles: Article[];
  onClearFilter?: () => void;
}

export function StoryList({ articles, onClearFilter }: StoryListProps) {
  if (articles.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-medium text-[#2C3E2D]">No stories found</p>
        <p className="mt-2 text-sm text-[#8A968B]">
          {onClearFilter ? 'Try another category or clear the current filter.' : 'Check back later for new articles.'}
        </p>
        {onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-5 rounded-full border border-[#5A8F6E] px-4 py-2 text-sm font-medium text-[#5A8F6E] transition-colors hover:bg-[#5A8F6E] hover:text-white"
          >
            Show all stories
          </button>
        )}
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
