/* bitesite/components/sections/category-filter.tsx */

"use client";

import { useCallback } from "react";
import { Clock, MapPin, Banknote, CreditCard, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const CUISINE_TAGS = ["Cafe", "Western", "Asian", "Dessert", "Japanese", "Bakery"];
const MORE_TAGS = [
  { label: "Halal", icon: null },
  { label: "Cash", icon: <Banknote className="h-3 w-3" /> },
  { label: "Cashless", icon: <Smartphone className="h-3 w-3" /> },
  { label: "Cards", icon: <CreditCard className="h-3 w-3" /> },
];

interface CategoryFilterProps {
  activeCuisines: string[];
  onCuisineChange: (tags: string[]) => void;
  activeArea: string | null;
  onAreaChange: (area: string | null) => void;
  activeMore: string[];
  onMoreChange: (more: string[]) => void;
  openNow: boolean;
  onOpenNowChange: (v: boolean) => void;
  availableAreas: string[];
}

export function CategoryFilter({
  activeCuisines,
  onCuisineChange,
  activeArea,
  onAreaChange,
  activeMore,
  onMoreChange,
  openNow,
  onOpenNowChange,
  availableAreas,
}: CategoryFilterProps) {
  const toggleCuisine = useCallback(
    (tag: string) => {
      if (activeCuisines.includes(tag)) {
        onCuisineChange(activeCuisines.filter((t) => t !== tag));
      } else {
        onCuisineChange([...activeCuisines, tag]);
      }
    },
    [activeCuisines, onCuisineChange]
  );

  const toggleMore = useCallback(
    (tag: string) => {
      if (activeMore.includes(tag)) {
        onMoreChange(activeMore.filter((t) => t !== tag));
      } else {
        onMoreChange([...activeMore, tag]);
      }
    },
    [activeMore, onMoreChange]
  );

  const isCuisineActive = (tag: string) => activeCuisines.includes(tag);
  const isMoreActive = (tag: string) => activeMore.includes(tag);

  const activeCount =
    activeCuisines.length +
    (activeArea && activeArea !== "All Areas" ? 1 : 0) +
    activeMore.length;

  return (
    <div className="sticky top-0 z-40 border-b border-[#DDE5DC] bg-[#FAFBF7]/95 backdrop-blur-sm px-4 py-4">
      <div className="mx-auto max-w-6xl space-y-3">
        {/* Row 1: Open Now + Cuisine */}
        <div className="flex flex-wrap items-center gap-2">
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

          {CUISINE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleCuisine(tag)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-200 active:scale-95 select-none",
                isCuisineActive(tag)
                  ? "bg-[#5A8F6E] text-white shadow-sm"
                  : "border border-[#DDE5DC] bg-white text-[#6B6560] active:bg-[#5A8F6E] active:text-white active:border-[#5A8F6E]"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Row 2: Area */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#8A968B] mr-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Area
          </span>
          {availableAreas.map((area) => (
            <button
              key={area}
              onClick={() => onAreaChange(area === "All Areas" ? null : area)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 select-none",
                (area === "All Areas" && !activeArea) || activeArea === area
                  ? "bg-[#2C3E2D] text-white"
                  : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#2C3E2D] hover:text-[#2C3E2D]"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {area}
            </button>
          ))}
        </div>

        {/* Row 3: More filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#8A968B] mr-1">More</span>
          {MORE_TAGS.map((item) => (
            <button
              key={item.label}
              onClick={() => toggleMore(item.label)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 select-none",
                isMoreActive(item.label)
                  ? "bg-[#5A8F6E] text-white shadow-sm"
                  : "border border-[#DDE5DC] bg-white text-[#6B6560]"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          {activeCount > 0 && (
            <button
              onClick={() => {
                onCuisineChange([]);
                onAreaChange(null);
                onMoreChange([]);
                onOpenNowChange(false);
              }}
              className="text-xs text-[#8A968B] underline underline-offset-2 active:text-[#5A8F6E] transition-colors ml-1"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
