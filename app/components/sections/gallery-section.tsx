/* bitesite/app/components/sections/gallery-section.tsx */

"use client";

import { useState, useCallback } from "react";
import { SafeImage } from "@/app/components/safe-image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

import type { LayoutKey } from "@/lib/layout-registry.mjs";
import { SectionTitle } from "@/components/ui/card";

/** Shared styling variant for section components. Sourced from the layout registry; the
 *  per-layout class strings live in lib/layout-theme.mjs, whose test fails if a registered
 *  layout has no complete theme. */
export type LayoutVariant = LayoutKey;

interface GallerySectionProps {
  images: string[];
  title?: string;
  variant?: LayoutVariant;
  id?: string;
}

export function GallerySection({
  images,
  title = "Photos",
  id,
}: GallerySectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const validImages = images
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .filter((url, i, arr) => arr.indexOf(url) === i);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    document.body.style.overflow = "hidden";
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    document.body.style.overflow = "";
  }, []);

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex((prev) =>
      prev !== null && prev < validImages.length - 1 ? prev + 1 : prev
    );
  }, [validImages.length]);

  if (validImages.length === 0) {
    return null;
  }

  return (
    <>
      {/* One swipeable row on phones (R2 redesign); tap a photo to see it large. */}
      <section id={id} aria-labelledby={`${id ?? "gallery"}-heading`} className="mx-auto max-w-5xl pt-7">
        <SectionTitle id={`${id ?? "gallery"}-heading`} className="px-4">{title}</SectionTitle>
        <ul className="mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {validImages.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => openLightbox(i)}
                aria-label={`Open photo ${i + 1} of ${validImages.length}`}
                className="relative block size-40 overflow-hidden rounded-[18px] bg-surface touch-manipulation md:size-48"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <SafeImage src={src} alt="" fill className="object-cover" sizes="192px" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Close gallery"
          >
            <X size={32} strokeWidth={1.5} />
          </button>
          <div className="absolute top-4 left-4 text-white/60 text-sm font-medium">
            {lightboxIndex + 1} / {validImages.length}
          </div>
          <div className="relative w-full max-w-5xl mx-4 aspect-[4/3]">
            <SafeImage
              src={validImages[lightboxIndex]}
              alt="Gallery preview"
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
          {lightboxIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-all active:scale-90"
              aria-label="Previous image"
            >
              <ChevronLeft size={28} />
            </button>
          )}
          {lightboxIndex < validImages.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-all active:scale-90"
              aria-label="Next image"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
