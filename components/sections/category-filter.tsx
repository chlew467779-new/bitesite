/* bitesite/components/sections/category-filter.tsx */

"use client";

import { useCallback, useState, useEffect } from "react";
import { Clock, MapPin, Banknote, CreditCard, Smartphone, ChevronDown, ChevronUp, X } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-collapse when scrolling down past 120px
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 120 && !collapsed) {
        setCollapsed(true);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setIsAnimating(true);
    setCollapsed((prev) => !prev);
    setTimeout(() => setIsAnimating(false), 400);
  }, []);

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
    activeMore.length +
    (openNow ? 1 : 0);

  const summaryItems: { label: string; type: string }[] = [];
  if (openNow) summaryItems.push({ label: "Open Now", type: "open" });
  activeCuisines.forEach((c) => summaryItems.push({ label: c, type: "cuisine" }));
  if (activeArea && activeArea !== "All Areas") summaryItems.push({ label: activeArea, type: "area" });
  activeMore.forEach((m) => summaryItems.push({ label: m, type: "more" }));

  const handleClearAll = useCallback(() => {
    onCuisineChange([]);
    onAreaChange(null);
    onMoreChange([]);
    onOpenNowChange(false);
  }, [onCuisineChange, onAreaChange, onMoreChange, onOpenNowChange]);

  return (
    <div className="sticky top-0 z-40 border-b border-[#DDE5DC] bg-[#FAFBF7]/95 backdrop-blur-sm px-4 py-3">
      <div className="mx-auto max-w-6xl">
        {/* ===== COLLAPSED MODE ===== */}
        <div
          className={cn(
            "grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
            collapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
          style={{ pointerEvents: collapsed ? "auto" : "none" }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <button
              onClick={toggleCollapsed}
              className="flex items-center gap-1 rounded-full bg-[#5A8F6E]/10 px-3 py-1.5 text-xs font-medium text-[#5A8F6E] hover:bg-[#5A8F6E]/20 transition-all active:scale-95 shrink-0"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
              Filters
              {activeCount > 0 && (
                <span className="ml-0.5 rounded-full bg-[#5A8F6E] text-white px-1.5 py-0 text-[10px]">
                  {activeCount}
                </span>
              )}
            </button>

            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {summaryItems.map((item, i) => (
                <span
                  key={`${item.type}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#5A8F6E]/10 px-2.5 py-1 text-[10px] font-medium text-[#5A8F6E] whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {item.label}
                </span>
              ))}
            </div>

            {activeCount > 0 && (
              <button
                onClick={handleClearAll}
                className="shrink-0 text-[10px] text-[#8A968B] hover:text-[#5A8F6E] transition-colors underline underline-offset-2"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ===== EXPANDED MODE ===== */}
        <div
          className={cn(
            "grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
            collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
          )}
          style={{ pointerEvents: collapsed ? "none" : "auto" }}
        >
          <div className="space-y-3 overflow-hidden">
            {/* Row 1: Open Now + Cuisine + Collapse button */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onOpenNowChange(!openNow)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 active:scale-95 select-none",
                  openNow
                    ? "bg-green-500 text-white shadow-sm"
                    : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-green-400 hover:text-green-600"
                )}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Clock className="h-3 w-3" />
                Open Now
              </button>

              {CUISINE_TAGS.map((tag, i) => (
                <button
                  key={tag}
                  onClick={() => toggleCuisine(tag)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-300 active:scale-95 select-none",
                    isCuisineActive(tag)
                      ? "bg-[#5A8F6E] text-white shadow-sm scale-100"
                      : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
                  )}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  {tag}
                </button>
              ))}

              <button
                onClick={toggleCollapsed}
                className="ml-auto flex items-center gap-1 text-[#8A968B] hover:text-[#5A8F6E] transition-all duration-300 p-1 active:scale-90"
                title="Collapse filters"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>

            {/* Row 2: Area */}
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 transition-all duration-400",
                collapsed ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
              )}
              style={{ transitionDelay: "50ms" }}
            >
              <span className="text-xs text-[#8A968B] mr-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Area
              </span>
              {availableAreas.map((area, i) => (
                <button
                  key={area}
                  onClick={() => onAreaChange(area === "All Areas" ? null : area)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 active:scale-95 select-none",
                    (area === "All Areas" && !activeArea) || activeArea === area
                      ? "bg-[#2C3E2D] text-white shadow-sm"
                      : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#2C3E2D] hover:text-[#2C3E2D]"
                  )}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    transitionDelay: `${i * 20}ms`,
                  }}
                >
                  {area}
                </button>
              ))}
            </div>

            {/* Row 3: More filters + Clear All */}
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 transition-all duration-400",
                collapsed ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
              )}
              style={{ transitionDelay: "100ms" }}
            >
              <span className="text-xs text-[#8A968B] mr-1">More</span>
              {MORE_TAGS.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => toggleMore(item.label)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 active:scale-95 select-none",
                    isMoreActive(item.label)
                      ? "bg-[#5A8F6E] text-white shadow-sm"
                      : "border border-[#DDE5DC] bg-white text-[#6B6560] hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
                  )}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    transitionDelay: `${i * 20}ms`,
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}

              {activeCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-[#8A968B] underline underline-offset-2 active:text-[#5A8F6E] transition-colors ml-1 hover:text-[#5A8F6E]"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
