/* bitesite/components/sections/map-section.tsx */

"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { X, ArrowRight, Locate, Search, MapPin } from "lucide-react";
import type { Merchant } from "@/types";
import { getTodayHours } from "@/lib/hours";
import { getMarkerColor } from "@/lib/map-colors";
import { trackEvent } from '@/lib/analytics';

interface MapSectionProps {
  merchants: Merchant[];
  selectedMerchant: Merchant | null;
  onSelect: (merchant: Merchant | null) => void;
}

export function MapSection({ merchants, selectedMerchant, onSelect }: MapSectionProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const onSelectRef = useRef(onSelect);

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([3.139, 101.6869], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on("click", () => {
      onSelectRef.current(null);
    });

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          userLocationRef.current = { lat: latitude, lng: longitude };

          const pulseIcon = L.divIcon({
            className: "",
            html: `<div style="position:relative;width:20px;height:20px;">
              <div class="map-pulse-ring"></div>
              <div style="position:absolute;inset:0;border-radius:50%;background:#5A8F6E;border:2.5px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.4);z-index:2;"></div>
            </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          L.marker([latitude, longitude], { icon: pulseIcon, zIndexOffset: 1000 })
            .addTo(map)
            .bindPopup("You are here");

          map.flyTo([latitude, longitude], 14, { duration: 1.5 });
        },
        () => {}
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    onSelectRef.current(null);

    merchants.forEach((merchant) => {
      if (!merchant.latitude || !merchant.longitude) return;

      const type = merchant.cuisine_type?.split(",")[0].trim() || "Other";
      const color = getMarkerColor(type);
      const img = merchant.cover_image || "";

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:38px;height:38px;border-radius:50%;border:3px solid ${color};overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.35);background:${color};cursor:pointer;">
          <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'" />
        </div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([merchant.latitude, merchant.longitude], {
        icon,
      });

      marker.on("click", (e) => {
        e.originalEvent?.stopPropagation();
        onSelectRef.current(merchant);
        trackEvent('map_marker_click', { slug: merchant.slug, pageType: 'our_partner' });
      });

      layer.addLayer(marker);
    });
  }, [merchants]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedMerchant) return;

    if (selectedMerchant.latitude && selectedMerchant.longitude) {
      map.flyTo(
        [selectedMerchant.latitude, selectedMerchant.longitude],
        15,
        { duration: 1 }
      );
    }
  }, [selectedMerchant]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocationRef.current) {
      map.flyTo([userLocationRef.current.lat, userLocationRef.current.lng], 14);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          userLocationRef.current = { lat: latitude, lng: longitude };
          map.flyTo([latitude, longitude], 14);
        },
        () => {}
      );
    }
  };

  const selectedType = selectedMerchant?.cuisine_type?.split(",")[0].trim() || "Other";
  const selectedColor = getMarkerColor(selectedType);
  const { isOpen } = selectedMerchant
    ? getTodayHours(selectedMerchant.operating_hours)
    : { isOpen: false };

  const directionsUrl = selectedMerchant
    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedMerchant.latitude},${selectedMerchant.longitude}`
    : "";

  return (
    <div ref={containerRef} className="h-full w-full relative z-0">
      <style>{`
        @keyframes mapPulse {
          0% { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .map-pulse-ring {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: rgba(90, 143, 110, 0.45);
          animation: mapPulse 1.8s infinite;
          z-index: 1;
        }
      `}</style>

      <button
        onClick={handleRecenter}
        className="absolute right-4 top-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2C3E2D] shadow-lg border border-[#DDE5DC] transition-all hover:bg-[#F0F4EC] active:scale-90"
        style={{ WebkitTapHighlightColor: "transparent" }}
        title="Go to my location"
      >
        <Locate className="h-5 w-5" />
      </button>

      {merchants.length === 0 && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[#FAFBF7]/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#F0F4EC]">
              <Search className="h-7 w-7 text-[#8A968B]" />
            </div>
            <p className="text-lg font-medium text-[#2C3E2D]">No restaurants found</p>
            <p className="mt-2 text-sm text-[#8A968B]">
              Try adjusting your filters or search.
            </p>
          </div>
        </div>
      )}

      {selectedMerchant && (
        <div className="absolute bottom-6 left-1/2 z-[1000] w-[92%] max-w-sm -translate-x-1/2">
          <div className="relative rounded-2xl border border-[#DDE5DC] bg-white p-5 shadow-xl">
            <button
              onClick={() => onSelect(null)}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-[#8A968B] transition-colors hover:bg-[#F0F4EC] hover:text-[#2C3E2D]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <X className="h-4 w-4" />
            </button>

            {selectedMerchant.cover_image && (
              <div className="mb-3 h-28 w-full overflow-hidden rounded-xl">
                <img
                  src={selectedMerchant.cover_image}
                  alt={selectedMerchant.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <h3 className="mb-2 pr-6 font-serif text-lg font-medium text-[#2C3E2D]">
              {selectedMerchant.name}
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

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/store/${selectedMerchant.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#5A8F6E] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#4A7A5E] active:scale-[0.98]"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Go to Merchant Page
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#5A8F6E] px-5 py-2.5 text-sm font-semibold text-[#5A8F6E] transition-all hover:bg-[#5A8F6E]/10 active:scale-[0.98]"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <MapPin className="h-4 w-4" />
                Get Directions
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
