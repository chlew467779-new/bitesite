"use client";

import { useState, useCallback } from "react";
import { SafeImage } from "@/app/components/safe-image";
import { FadeIn } from "@/app/components/animations";
import { X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

export type LayoutVariant = "classic" | "elegant" | "minimal" | "modern" | "rustic";

interface GallerySectionProps {
  images: string[];
  title?: string;
  variant?: LayoutVariant;
}

const sectionBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-50/60",
  elegant: "bg-slate-950",
  minimal: "bg-stone-50",
  modern:  "bg-white",
  rustic:  "bg-orange-50/60",
};

const titleColor: Record<LayoutVariant, string> = {
  classic: "text-amber-900",
  elegant: "text-amber-100",
  minimal: "text-stone-800",
  modern:  "text-slate-900",
  rustic:  "text-orange-900",
};

const emptyStateBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-100/50",
  elegant: "bg-slate-800",
  minimal: "bg-stone-100",
  modern:  "bg-slate-100",
  rustic:  "bg-orange-100/50",
};

export function GallerySection({
  images,
  title = "Gallery",
  variant = "classic",
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
    return (
      <FadeIn>
        <section className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className={`text-2xl font-bold mb-3 ${titleColor[variant]}`}>{title}</h2>
            <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl ${emptyStateBg[variant]}`}>
              <ImageIcon size={18} className={`opacity-50 ${titleColor[variant]}`} />
              <span className={`text-sm opacity-60 ${titleColor[variant]}`}>
                No gallery images yet. Add photos to your menu items or cover image to see them here.
              </span>
            </div>
          </div>
        </section>
      </FadeIn>
    );
  }

  return (
    <>
      <FadeIn>
        <section className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
          <div className="max-w-6xl mx-auto">
            <h2 className={`text-3xl font-bold text-center mb-10 ${titleColor[variant]}`}>
              {title}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {validImages.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  onClick={() => openLightbox(i)}
                  className={`
                    relative overflow-hidden rounded-xl
                    ${i % 5 === 0 ? "col-span-2 row-span-2" : "aspect-square"}
                    group
                    active:scale-[0.96] transition-transform duration-150
                    touch-manipulation
                  `}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <SafeImage
                    src={src}
                    alt={`Gallery image ${i + 1}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

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
