"use client";

import { cn } from "@/lib/utils";

interface DiamondSeparatorProps {
  className?: string;
  color?: string;
}

export function DiamondSeparator({ className, color = "#8A968B" }: DiamondSeparatorProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-6", className)}>
      <span className="inline-block h-px w-12" style={{ backgroundColor: color }} />
      <span className="text-sm" style={{ color }}>◆</span>
      <span className="inline-block h-px w-12" style={{ backgroundColor: color }} />
    </div>
  );
}
