/* bitesite/components/ui/chip.tsx */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Filter / toggle pill (44px tall). Pass `selected` for the on state.
export const chipClasses = (selected = false) =>
  cn(
    "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [-webkit-tap-highlight-color:transparent]",
    selected
      ? "bg-brand text-white"
      : "border border-line-strong bg-white text-ink hover:bg-surface"
  );

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean };

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { className, selected = false, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(chipClasses(selected), className)}
      {...props}
    />
  );
});
