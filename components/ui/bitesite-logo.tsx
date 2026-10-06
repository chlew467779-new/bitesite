/* bitesite/components/ui/bitesite-logo.tsx */

export function BiteSiteLogo({ showTagline = false, size = "default" }: { showTagline?: boolean; size?: "small" | "default" | "large" }) {
  const markSizes = { small: 32, default: 40, large: 48 };
  const mark = markSizes[size];

  const textSizes = { small: "text-[19px]", default: "text-[22px]", large: "text-[26px]" };
  const taglineSizes = { small: "text-[9px]", default: "text-[10px]", large: "text-[11px]" };

  return (
    <div className="flex items-center gap-2">
      {/* Leaf mark on a forest-green tile */}
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-[10px] bg-brand"
        style={{ width: mark, height: mark }}
      >
        <svg
          width={Math.round(mark * 0.56)}
          height={Math.round(mark * 0.56)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21c-5-3-7-7-7-11a7 7 0 0 1 14 0c0 4-2 8-7 11z" />
          <path d="M12 21V9" />
        </svg>
      </span>

      <div className="flex flex-col">
        <span className={`${textSizes[size]} font-extrabold leading-none tracking-[-0.02em] text-ink`}>
          BiteSite
        </span>
        {showTagline && (
          <span className={`${taglineSizes[size]} mt-1 font-semibold uppercase tracking-[0.18em] text-brand`}>
            Every Bite Tells a Story
          </span>
        )}
      </div>
    </div>
  );
}
