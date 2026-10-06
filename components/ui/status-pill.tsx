/* bitesite/components/ui/status-pill.tsx */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  open: "bg-open-bg text-open",
  closed: "bg-surface text-muted",
  soldout: "bg-soldout-bg text-soldout",
  neutral: "bg-brand-soft text-brand",
  // White pill over a photo (home cards, store cover).
  onPhoto: "bg-white text-open",
} as const;

// Small 28px status label: "Open · till 3 pm", "Sold out today", "Halal"…
export function StatusPill({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: keyof typeof tones;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold",
        tones[tone],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            tone === "open" || tone === "onPhoto" ? "bg-open-dot" : "bg-current"
          )}
        />
      )}
      {children}
    </span>
  );
}
