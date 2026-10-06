/* bitesite/app/components/safe-image.tsx */

"use client";

import { useState } from "react";
import Image from "next/image";
import { getOptimizedImageUrl } from "@/lib/image-utils";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
}

/**
 * next/image with a quiet fallback for a missing or broken photo. The photo shows as soon as the
 * browser paints it, over a grey surface: no fade-in (2026-10 redesign). The old fade waited for
 * onLoad, and a photo that finished loading before React attached the handler stayed invisible.
 */
export function SafeImage({
  src,
  alt,
  className = "",
  fill = false,
  width,
  height,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: SafeImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`flex items-center justify-center bg-surface ${fill ? "absolute inset-0" : ""} ${className}`}
        style={!fill ? { width, height } : undefined}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted opacity-40"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  const imageProps = fill
    ? { fill, sizes, className }
    : { width, height, className };

  return (
    <div
      className={`relative overflow-hidden bg-surface ${fill ? "w-full h-full" : ""}`}
      style={!fill ? { width, height } : undefined}
    >
      <Image
        src={getOptimizedImageUrl(src, fill ? 800 : width)}
        alt={alt}
        {...imageProps}
        priority={priority}
        onError={() => setError(true)}
      />
    </div>
  );
}
