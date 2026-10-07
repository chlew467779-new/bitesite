/* bitesite/components/sections/map-sidebar.tsx */

"use client";

import { useT } from "@/lib/i18n";

import { useEffect, useRef } from "react";
import { SafeImage } from "@/app/components/safe-image";
import { getTodayHours } from "@/lib/hours";
import { getMarkerColor } from "@/lib/map-colors";
import type { PublicMerchant } from "@/types";
import { Clock, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";
import { merchantCuisines } from "@/lib/discovery-core.mjs";

interface MapSidebarProps {
  merchants: PublicMerchant[];
  selected: PublicMerchant | null;
  onSelect: (merchant: PublicMerchant | null) => void;
}

export function MapSidebar({ merchants, selected, onSelect }: MapSidebarProps) {
  const t = useT();
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
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface">
          <MapPin className="h-5 w-5 text-muted" />
        </div>
        <p className="text-sm font-bold text-ink">{t("map.empty.title")}</p>
        <p className="mt-1 text-xs text-muted">{t("map.empty.body")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-line bg-page px-4 py-3">
        <p className="text-xs font-medium text-muted">
          {t("map.count", { count: merchants.length })}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-line">
          {merchants.map((merchant) => {
            const isSelected = selected?.id === merchant.id;
            const type = merchantCuisines(merchant)[0] || "Other";
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
                    ? "bg-brand/10"
                    : "bg-white hover:bg-surface"
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
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted truncate">
                        {type}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-ink truncate">
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
                        {isOpen ? t("map.open") : t("map.closed")}
                      </span>
                      {merchant.area && (
                        <span className="text-[10px] text-muted truncate">
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
                      className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-brand-hover"
                    >
                      {t("map.view")}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-brand hover:text-brand"
                    >
                      {t("map.directions")}
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
