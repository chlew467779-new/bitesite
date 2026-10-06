/* bitesite/components/ui/search-input.tsx */

import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

// 52px search field. Font stays 16px so iPhone Safari does not zoom in on focus.
export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; wrapperClassName?: string }
>(function SearchInput({ label, className, wrapperClassName, ...props }, ref) {
  return (
    <label
      className={cn(
        "flex h-[52px] items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand",
        wrapperClassName
      )}
    >
      <Search aria-hidden size={20} className="shrink-0 text-muted" />
      <span className="sr-only">{label}</span>
      <input
        ref={ref}
        type="search"
        className={cn(
          "min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted",
          className
        )}
        {...props}
      />
    </label>
  );
});
