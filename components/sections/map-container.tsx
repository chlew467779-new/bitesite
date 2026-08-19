/* bitesite/components/sections/map-container.tsx */

"use client";

import { useState } from "react";
import { MapSection } from "./map-section";
import { MapFilter } from "./map-filter";
import type { Merchant } from "@/types";

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
