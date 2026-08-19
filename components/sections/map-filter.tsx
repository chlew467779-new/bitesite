/* bitesite/components/sections/map-filter.tsx */

"use client";

import { cn } from "@/lib/utils";
import { getMarkerColor } from "@/lib/map-colors";
import { Search, X } from "lucide-react";

const CUISINE_TYPES = ["All", "Cafe", "Western", "Bakery", "Japanese", "Asian", "Dessert"];

interface MapFilterProps {
  activeTypes: string[];
  onChange: (types: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function MapFilter({ activeTypes, onChange, searchQuery, onSearchChange }: MapFilterProps) {
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
    <div className="sticky top-0 z-40 border-b border-[#DDE5DC] bg-[#FAFBF7]/95 backdrop-blur-sm px-4 py-3">
      <div className="mx-auto max-w-6xl space-y-3">
        {/* 类型筛选 */}
        <div className="flex flex-wrap items-center gap-2">
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

        {/* 搜索框 */}
        <div
          className={cn(
            "relative w-full max-w-md rounded-full bg-white shadow-sm transition-all duration-300",
            searchQuery ? "ring-1 ring-[#5A8F6E]" : ""
          )}
        >
          <div className="flex items-center">
            <Search className="ml-4 h-4 w-4 flex-shrink-0 text-[#8A968B]" />
            <input
              type="text"
              placeholder="Search restaurant name, area..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent py-2.5 pl-3 pr-10 text-sm text-[#2C3E2D] outline-none placeholder:text-[#8A968B]"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="mr-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#DDE5DC] text-[#6B6560] active:scale-90 transition-transform"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
