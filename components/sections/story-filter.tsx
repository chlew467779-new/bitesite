/* bitesite/components/sections/story-filter.tsx */

"use client";

import { cn } from "@/lib/utils";

interface StoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function StoryFilter({
  categories,
  activeCategory,
  onCategoryChange,
}: StoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-4">
      <button
        onClick={() => onCategoryChange(null)}
        className={cn(
          "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-200 active:scale-95 select-none",
          !activeCategory
            ? "bg-[#5A8F6E] text-white shadow-sm"
            : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(cat)}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-200 active:scale-95 select-none",
            activeCategory === cat
              ? "bg-[#5A8F6E] text-white shadow-sm"
              : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
          )}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
