"use client";

import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Cafe", "Western", "Asian", "Dessert"];

interface CategoryFilterProps {
  active: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-6">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={cn(
            "rounded-full px-5 py-2 text-sm font-medium uppercase tracking-wider transition-all duration-300",
            active === cat
              ? "bg-[#5A8F6E] text-white"
              : "border border-[#DDE5DC] bg-[#FAFBF7] text-[#6B6560] hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
