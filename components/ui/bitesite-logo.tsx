/* bitesite/components/ui/bitesite-logo.tsx */

"use client";

export function BiteSiteLogo({ showTagline = false, size = "default" }: { showTagline?: boolean; size?: "small" | "default" | "large" }) {
  const iconSizes = { small: 32, default: 40, large: 48 };
  const iconSize = iconSizes[size];

  const textSizes = { small: "text-base", default: "text-xl", large: "text-2xl" };
  const taglineSizes = { small: "text-[8px]", default: "text-[9px]", large: "text-[10px]" };

  return (
    <div className="flex items-center gap-3">
      {/* Leaf Icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <circle cx="28" cy="28" r="26" stroke="#5A8F6E" strokeWidth="2.5" />
        <path
          d="M28 14 C28 14, 20 24, 20 34 C20 40, 24 44, 28 44 C32 44, 36 40, 36 34 C36 24, 28 14, 28 14Z"
          fill="#5A8F6E"
          fillOpacity="0.15"
        />
        <path
          d="M28 16 C28 16, 22 25, 22 34 C22 39, 25 42, 28 42 C31 42, 34 39, 34 34 C34 25, 28 16, 28 16Z"
          stroke="#5A8F6E"
          strokeWidth="2"
          fill="none"
        />
        <line x1="28" y1="16" x2="28" y2="42" stroke="#5A8F6E" strokeWidth="1.5" />
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col">
        <span
          className={`${textSizes[size]} font-bold text-[#2C3E2D] font-[family-name:var(--font-playfair)] tracking-tight leading-none`}
        >
          BiteSite
        </span>
        {showTagline && (
          <span
            className={`${taglineSizes[size]} font-medium text-[#5A8F6E] tracking-[0.2em] uppercase mt-0.5`}
          >
            Every Bite Tells a Story
          </span>
        )}
      </div>
    </div>
  );
}
