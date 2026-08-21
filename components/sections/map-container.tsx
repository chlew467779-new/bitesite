/* bitesite/components/sections/map-container.tsx */

"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { MapFilter } from "./map-filter";
import { MapSidebar } from "./map-sidebar";
import type { Merchant } from "@/types";

const MapSection = dynamic(
  () => import("./map-section").then((mod) => mod.MapSection),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[#F0F4EC]">
        <div className="text-[#8A968B] text-sm">Loading map...</div>
      </div>
    ),
  }
);

interface MapContainerProps {
  merchants: Merchant[];
}

export function MapContainer({ merchants }: MapContainerProps) {
  const [activeTypes, setActiveTypes] = useState<string[]>(["All"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);

  const filteredMerchants = useMemo(() => {
    let result = activeTypes.includes("All")
      ? merchants
      : merchants.filter((m) => {
          const type = m.cuisine_type?.split(",")[0].trim();
          return type && activeTypes.includes(type);
        });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.cuisine_type || "").toLowerCase().includes(q) ||
          (m.area || "").toLowerCase().includes(q) ||
          (m.description || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [merchants, activeTypes, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <MapFilter
        activeTypes={activeTypes}
        onChange={setActiveTypes}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - desktop only */}
        <div className="hidden lg:block w-80 xl:w-96 border-r border-[#DDE5DC] bg-white flex-shrink-0">
          <MapSidebar
            merchants={filteredMerchants}
            selected={selectedMerchant}
            onSelect={setSelectedMerchant}
          />
        </div>
        {/* Map */}
        <div className="flex-1 relative">
          <MapSection
            merchants={filteredMerchants}
            selectedMerchant={selectedMerchant}
            onSelect={setSelectedMerchant}
          />
        </div>
      </div>
    </div>
  );
}
