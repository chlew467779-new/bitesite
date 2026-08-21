/* bitesite/components/sections/map-sidebar.tsx */

"use client";

import { useEffect, useRef } from "react";
import { SafeImage } from "@/app/components/safe-image";
import { getTodayHours } from "@/lib/hours";
import { getMarkerColor } from "@/lib/map-colors";
import type { Merchant } from "@/types";
import { Clock, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";

interface MapSidebarProps {
  merchants: Merchant[];
  selected: Merchant | null;
  onSelect: (merchant: Merchant | null) => void;
}

export function MapSidebar({ merchants, selected, onSelect }: MapSidebarProps) {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 当选中变化时，滚动到对应项
  useEffect(() => {
    if (selected?.id) {
      const el = itemRefs.current.get(selected.id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selected]);

  if (merchants.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F4EC]">
          <MapPin className="h-5 w-5 text-[#8A968B]" />
        </div>
        <p className="text-sm font-medium text-[#2C3E2D]">No restaurants found</p>
        <p className="mt-1 text-xs text-[#8A968B]">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[#DDE5DC] bg-[#FAFBF7] px-4 py-3">
        <p className="text-xs font-medium text-[#8A968B]">
          {merchants.length} {merchants.length === 1 ? "restaurant" : "restaurants"} on map
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-[#DDE5DC]">
          {merchants.map((merchant) => {
            const isSelected = selected?.id === merchant.id;
            const type = merchant.cuisine_type?.split(",")[0].trim() || "Other";
            const color = getMarkerColor(type);
            const { isOpen } = getTodayHours(merchant.operating_hours);

            return (
              <div
                key={merchant.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(merchant.id, el);
                }}
                onClick={() => onSelect(isSelected ? null : merchant)}
                className={`cursor-pointer p-4 transition-colors ${
                  isSelected
                    ? "bg-[#5A8F6E]/10"
                    : "bg-white hover:bg-[#F0F4EC]"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                    <SafeImage
                      src={merchant.cover_image}
                      alt={merchant.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#8A968B] truncate">
                        {type}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-[#2C3E2D] truncate">
                      {merchant.name}
                    </h3>

                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isOpen
                            ? "bg-green-500/10 text-green-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {isOpen ? "Open" : "Closed"}
                      </span>
                      {merchant.area && (
                        <span className="text-[10px] text-[#8A968B] truncate">
                          {merchant.area}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions - only show when selected */}
                {isSelected && (
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/store/${merchant.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-full bg-[#5A8F6E] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#4A7A5E]"
                    >
                      View Page
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-full border border-[#DDE5DC] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6560] transition-all hover:border-[#5A8F6E] hover:text-[#5A8F6E]"
                    >
                      Directions
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
