/* bitesite/components/sections/map-container.tsx */

"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MapFilter } from "./map-filter";
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

  return (
    <div className="flex flex-col h-full">
      <MapFilter activeTypes={activeTypes} onChange={setActiveTypes} />
      <div className="flex-1 relative">
        <MapSection merchants={merchants} activeTypes={activeTypes} />
      </div>
    </div>
  );
}
