/* bitesite/components/ui/icon-button.tsx */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Round 44px icon button. `label` is required so screen readers can name it.
export const iconButtonClasses = cva(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 [-webkit-tap-highlight-color:transparent]",
  {
    variants: {
      variant: {
        plain: "bg-transparent text-ink hover:bg-surface",
        soft: "bg-surface text-ink hover:bg-line",
        // Over photos (store cover): white disc with a soft shadow.
        overlay: "bg-white/95 text-ink shadow-[0_2px_10px_rgba(0,0,0,0.12)] hover:bg-white",
      },
    },
    defaultVariants: { variant: "plain" },
  }
);

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> &
  VariantProps<typeof iconButtonClasses> & { label: string };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, label, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonClasses({ variant }), className)}
      {...props}
    />
  );
});
