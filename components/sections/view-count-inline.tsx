/* bitesite/components/sections/view-count-inline.tsx */

interface ViewCountInlineProps {
  count: number;
  size?: "sm" | "md";
  className?: string;
}

export function ViewCountInline({ count, size = "md", className = "" }: ViewCountInlineProps) {
  const formatted = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px] gap-1" : "px-3 py-1 text-xs gap-1.5";

  return (
    <span 
      className={`inline-flex items-center rounded-full bg-black/30 text-white border border-white/20 backdrop-blur-sm ${sizeClasses} ${className}`}
      suppressHydrationWarning
    >
      <svg width={size === "sm" ? 10 : 12} height={size === "sm" ? 10 : 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {formatted}
    </span>
  );
}
