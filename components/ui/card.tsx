/* bitesite/components/ui/card.tsx */

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Info card: light grey surface, 20px corners, 16px padding (hours, payments, map…).
export function Card({
  className,
  tone = "surface",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "surface" | "outline" | "brand" }) {
  return (
    <div
      className={cn(
        "rounded-[20px] p-4",
        tone === "surface" && "bg-surface",
        tone === "outline" && "border border-line bg-page",
        tone === "brand" && "bg-brand text-on-brand",
        className
      )}
      {...props}
    />
  );
}

// Section heading used on the home and store pages ("Open near you", "Menu"…).
export function SectionTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-xl font-extrabold tracking-[-0.02em] text-ink", className)}
      {...props}
    />
  );
}
