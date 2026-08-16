/* bitesite/components/sections/category-filter.tsx */

"use client";

import { useCallback } from "react";
import { Clock, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_TAGS = ["Cafe", "Western", "Asian", "Dessert", "Halal"];

interface CategoryFilterProps {
  activeTags: string[];
  onChange: (tags: string[]) => void;
  openNow: boolean;
  onOpenNowChange: (v: boolean) => void;
}

export function CategoryFilter({
  activeTags,
  onChange,
  openNow,
  onOpenNowChange,
}: CategoryFilterProps) {
  const toggleTag = useCallback(
    (tag: string) => {
      if (activeTags.includes(tag)) {
        onChange(activeTags.filter((t) => t !== tag));
      } else {
        onChange([...activeTags, tag]);
      }
    },
    [activeTags, onChange]
  );

  const isActive = (tag: string) => activeTags.includes(tag);

  return (
    <div className="sticky top-0 z-40 border-b border-[#DDE5DC] bg-[#FAFBF7]/95 backdrop-blur-sm px-4 py-4">
      <div className="mx-auto max-w-6xl">
        {/* Quick toggles */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onOpenNowChange(!openNow)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 active:scale-95 select-none",
              openNow
                ? "bg-green-500 text-white shadow-sm"
                : "border border-[#DDE5DC] bg-white text-[#6B6560]"
            )}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Clock className="h-3 w-3" />
            Open Now
          </button>
        </div>

        {/* Tag filters */}
        <div className="flex flex-wrap items-center gap-2">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                "relative rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-200 active:scale-95 select-none",
                isActive(tag)
                  ? "bg-[#5A8F6E] text-white shadow-sm"
                  : "border border-[#DDE5DC] bg-white text-[#6B6560] active:bg-[#5A8F6E] active:text-white active:border-[#5A8F6E]"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {tag === "Halal" && <Leaf className="inline h-3 w-3 mr-1" />}
              {tag}
              {isActive(tag) && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">
                  ✓
                </span>
              )}
            </button>
          ))}

          {/* Clear all */}
          {activeTags.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-xs text-[#8A968B] underline underline-offset-2 active:text-[#5A8F6E] transition-colors ml-1"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
