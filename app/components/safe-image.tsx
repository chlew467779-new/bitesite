/* bitesite/app/components/safe-image.tsx */

"use client";

import { useState } from "react";
import Image from "next/image";

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
  const [loading, setLoading] = useState(true);

  if (!src || error) {
    return (
      <div
        className={`bg-gray-100 flex flex-col items-center justify-center ${className}`}
        style={!fill ? { width, height } : undefined}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-gray-300 mb-1"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-gray-300 text-xs">No Image</span>
      </div>
    );
  }

  const imageClass = `${className} ${
    loading ? "opacity-0 scale-105" : "opacity-100 scale-100"
  } transition-all duration-700 ease-out`;

  const imageProps = fill
    ? { fill, sizes, className: imageClass }
    : { width, height, className: imageClass };

  return (
    <div
      className={`relative overflow-hidden ${
        fill ? "w-full h-full" : ""
      }`}
      style={!fill ? { width, height } : undefined}
    >
      {loading && (
        <div
          className={`absolute inset-0 bg-gray-100 animate-pulse z-10`}
        />
      )}
      <Image
        src={src}
        alt={alt}
        {...imageProps}
        priority={priority}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </div>
  );
}
