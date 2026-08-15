"use client";

import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Cafe", "Western", "Asian", "Dessert"];

interface CategoryFilterProps {
  active: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="sticky top-0 z-40 border-b border-[#DDE5DC] bg-[#FAFBF7]/95 backdrop-blur-sm px-4 py-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={cn(
              "relative rounded-full px-5 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-200 active:scale-95 select-none",
              active === cat
                ? "bg-[#5A8F6E] text-white shadow-sm"
                : "border border-[#DDE5DC] bg-white text-[#6B6560] active:bg-[#5A8F6E] active:text-white active:border-[#5A8F6E]"
            )}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {cat}
            {active === cat && (
              <span className="absolute inset-0 rounded-full animate-ping bg-[#5A8F6E]/20" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
