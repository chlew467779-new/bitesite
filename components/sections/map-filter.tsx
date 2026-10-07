/* bitesite/components/sections/map-filter.tsx */

"use client";

import { presetLabel, useLang, useT } from "@/lib/i18n";

import { cn } from "@/lib/utils";
import { getMarkerColor } from "@/lib/map-colors";
import { Search, X } from "lucide-react";

interface MapFilterProps {
  activeTypes: string[];
  onChange: (types: string[]) => void;
  availableTypes: string[];
  activeArea: string | null;
  onAreaChange: (area: string | null) => void;
  availableAreas: string[];
  missingCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function MapFilter({ activeTypes, onChange, availableTypes, activeArea, onAreaChange, availableAreas, missingCount, searchQuery, onSearchChange }: MapFilterProps) {
  const t = useT();
  const lang = useLang();
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
    <div className="sticky top-0 z-40 border-b border-line bg-page/95 backdrop-blur-sm px-4 py-3">
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 pb-1" role="group" aria-label={t("map.cuisineLabel")}>
          <div className="flex w-max min-w-full items-center gap-2">
          {["All", ...availableTypes].map((type) => {
            const isActive = activeTypes.includes(type);
            const color = type === "All" ? null : getMarkerColor(type);

            return (
              <button
                key={type}
                onClick={() => toggle(type)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 active:scale-95 select-none",
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "border border-line bg-white text-muted hover:border-brand hover:text-brand"
                )}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {color && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
                {type === "All" ? t("map.all") : presetLabel(lang, type)}
              </button>
            );
          })}
          </div>
        </div>

        {availableAreas.length > 0 && <div className="-mx-4 overflow-x-auto px-4 pb-1" role="group" aria-label={t("map.areaLabel")}>
          <div className="flex w-max min-w-full items-center gap-2">
            <span className="shrink-0 text-xs text-muted">{t("map.area")}</span>
            {[null, ...availableAreas].map((area) => <button key={area ?? 'all'} type="button" aria-pressed={activeArea === area} onClick={() => onAreaChange(area)}
              className={cn("min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium", activeArea === area ? "bg-brand text-on-brand" : "border border-line bg-white text-muted hover:border-ink")}>
              {area ?? t("map.allAreas")}
            </button>)}
          </div>
        </div>}

        {/* 搜索框 */}
        <div
          className={cn(
            "relative w-full max-w-md rounded-full bg-white shadow-sm transition-all duration-300",
            searchQuery ? "ring-1 ring-brand" : ""
          )}
        >
          <div className="flex items-center">
            <Search className="ml-4 h-4 w-4 flex-shrink-0 text-muted" />
            <input
              type="text"
              aria-label={t("map.searchLabel")}
              placeholder={t("map.search")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="min-h-11 w-full bg-transparent py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-line text-muted active:scale-90 transition-transform"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {missingCount > 0 && <p className="text-xs text-muted">{t(missingCount === 1 ? "map.missingOne" : "map.missing", { count: missingCount })}</p>}
      </div>
    </div>
  );
}
