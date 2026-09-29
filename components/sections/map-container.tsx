/* bitesite/components/sections/map-container.tsx */

"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { MapFilter } from "./map-filter";
import { MapSidebar } from "./map-sidebar";
import type { PublicMerchant } from "@/types";
import type { AreaItem } from "@/lib/areas-core.mjs";
import { merchantCuisines } from "@/lib/discovery-core.mjs";
import { mapDiscoveryOptions } from "@/lib/map-discovery-core.mjs";

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
  merchants: PublicMerchant[];
  areas: AreaItem[];
}

export function MapContainer({ merchants, areas }: MapContainerProps) {
  const [activeTypes, setActiveTypes] = useState<string[]>(["All"]);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<PublicMerchant | null>(null);
  const options = useMemo(() => mapDiscoveryOptions(merchants, areas), [merchants, areas]);

  const filteredMerchants = useMemo(() => {
    let result = activeTypes.includes("All")
      ? options.mapped
      : options.mapped.filter((m) => {
          return merchantCuisines(m).some((type) => activeTypes.some((selected) => selected.toLocaleLowerCase() === type.toLocaleLowerCase()));
        });

    if (activeArea) result = result.filter((merchant) => merchant.area === activeArea);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          merchantCuisines(m).some((type) => type.toLowerCase().includes(q)) ||
          (m.area || "").toLowerCase().includes(q) ||
          (m.description || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [merchants, options.mapped, activeTypes, activeArea, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <MapFilter
        activeTypes={activeTypes}
        onChange={setActiveTypes}
        availableTypes={options.cuisines}
        activeArea={activeArea}
        onAreaChange={setActiveArea}
        availableAreas={options.areas}
        missingCount={options.missingCount}
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
