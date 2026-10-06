/* bitesite/components/ui/button.tsx */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// One button look for the whole site (docs/DESIGN.md). For links that should look like a
// button, use `buttonClasses({ variant, size })` on <Link>.
export const buttonClasses = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50 [-webkit-tap-highlight-color:transparent]",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-hover",
        kaya: "bg-kaya text-kaya-ink hover:bg-kaya-hover",
        secondary: "border border-line-strong bg-white text-ink hover:bg-surface",
        ghost: "bg-transparent text-ink hover:bg-surface",
      },
      size: {
        md: "min-h-11 rounded-[14px] px-4 text-sm",
        lg: "min-h-12 rounded-[14px] px-5 text-[15px]",
        xl: "min-h-[52px] rounded-2xl px-6 text-base",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonClasses>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonClasses({ variant, size, block }), className)}
      {...props}
    />
  );
});
