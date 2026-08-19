/* bitesite/components/sections/map-filter.tsx */

"use client";

import { cn } from "@/lib/utils";
import { getMarkerColor } from "@/lib/map-colors";

const CUISINE_TYPES = ["All", "Cafe", "Western", "Bakery", "Japanese", "Asian", "Dessert"];

interface MapFilterProps {
  activeTypes: string[];
  onChange: (types: string[]) => void;
}

export function MapFilter({ activeTypes, onChange }: MapFilterProps) {
  const toggle = (type: string) => {
    if (type === "All") {
      onChange(["All"]);
      return;
    }

    const withoutAll = activeTypes.filter((t) => t !== "All");

    if (activeTypes.includes(type)) {
      const next = withoutAll.filter((t) => t !== type);
      onChange(next.length === 0 ? ["All"] : next);
    } else {
      onChange([...withoutAll, type]);
    }
  };

  return (
    <div className="border-b border-[#DDE5DC] bg-[#FAFBF7]/95 backdrop-blur-sm px-4 py-3 z-10">
      <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-2">
        {CUISINE_TYPES.map((type) => {
          const isActive = activeTypes.includes(type);
          const color = type === "All" ? null : getMarkerColor(type);

          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 active:scale-95 select-none",
                isActive
                  ? "bg-[#5A8F6E] text-white shadow-sm"
                  : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {color && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}
