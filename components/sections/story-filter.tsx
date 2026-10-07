/* bitesite/components/sections/story-filter.tsx */

"use client";

import { Chip } from "@/components/ui/chip";
import { useT } from "@/lib/i18n";

interface StoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

/** Story categories as one scrolling row of chips (R10). Category names are Story content. */
export function StoryFilter({ categories, activeCategory, onCategoryChange }: StoryFilterProps) {
  const t = useT();
  return (
    <div role="group" aria-label={t("stories.title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
      <Chip selected={!activeCategory} onClick={() => onCategoryChange(null)}>{t("stories.all")}</Chip>
      {categories.map((cat) => (
        <Chip key={cat} selected={activeCategory === cat} onClick={() => onCategoryChange(cat)}>{cat}</Chip>
      ))}
    </div>
  );
}
