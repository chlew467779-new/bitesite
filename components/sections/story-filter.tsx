/* bitesite/components/sections/story-filter.tsx */

"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface StoryFilterProps {
  categories: string[];
  activeCategory: string | null;
}

export function StoryFilter({ categories, activeCategory }: StoryFilterProps) {
  const router = useRouter();

  const handleCategoryChange = (category: string | null) => {
    if (category) {
      router.push(`/stories?category=${encodeURIComponent(category)}`);
    } else {
      router.push("/stories");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-4">
      <button
        onClick={() => handleCategoryChange(null)}
        className={cn(
          "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all active:scale-95 select-none",
          !activeCategory
            ? "bg-[#5A8F6E] text-white"
            : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => handleCategoryChange(cat)}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all active:scale-95 select-none",
            activeCategory === cat
              ? "bg-[#5A8F6E] text-white"
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
