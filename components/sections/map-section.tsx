/* bitesite/components/sections/map-section.tsx */

"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import type { Merchant } from "@/types";
import { getTodayHours } from "@/lib/hours";
import { getMarkerColor } from "@/lib/map-colors";

interface MapSectionProps {
  merchants: Merchant[];
  activeTypes: string[];
}

export function MapSection({ merchants, activeTypes }: MapSectionProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [selected, setSelected] = useState<Merchant | null>(null);

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([3.139, 101.6869], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // 点击地图空白处关闭卡片
    map.on("click", () => {
      setSelected(null);
    });

    // 获取用户位置
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: "#5A8F6E",
            color: "#ffffff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          })
            .addTo(map)
            .bindPopup("You are here");
          map.flyTo([latitude, longitude], 14, { duration: 1.5 });
        },
        () => {
          // 用户拒绝或失败，保持默认 KL 视图
        }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 根据筛选更新标记
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    setSelected(null);

    const filtered = activeTypes.includes("All")
      ? merchants
      : merchants.filter((m) => {
          const type = m.cuisine_type?.split(",")[0].trim();
          return type && activeTypes.includes(type);
        });

    filtered.forEach((merchant) => {
      if (!merchant.latitude || !merchant.longitude) return;

      const type = merchant.cuisine_type?.split(",")[0].trim() || "Other";
      const color = getMarkerColor(type);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="width:7px;height:7px;background:white;border-radius:50%;"></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([merchant.latitude, merchant.longitude], {
        icon,
      });

      marker.on("click", () => {
        setSelected(merchant);
      });

      layer.addLayer(marker);
    });
  }, [merchants, activeTypes]);

  const selectedType = selected?.cuisine_type?.split(",")[0].trim() || "Other";
  const selectedColor = getMarkerColor(selectedType);
  const { isOpen } = selected
    ? getTodayHours(selected.operating_hours)
    : { isOpen: false };

  return (
    <div ref={containerRef} className="h-full w-full relative z-0">
      {selected && (
        <div className="absolute bottom-6 left-1/2 z-[1000] w-[92%] max-w-sm -translate-x-1/2">
          <div className="relative rounded-2xl border border-[#DDE5DC] bg-white p-5 shadow-xl">
            <button
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-[#8A968B] transition-colors hover:bg-[#F0F4EC] hover:text-[#2C3E2D]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="mb-2 pr-6 font-serif text-lg font-medium text-[#2C3E2D]">
              {selected.name}
            </h3>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isOpen
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {isOpen ? "Open" : "Closed"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#6B6560]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedColor }}
                />
                {selectedType}
              </span>
            </div>

            <Link
              href={`/store/${selected.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#5A8F6E] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Go to Merchant Page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
