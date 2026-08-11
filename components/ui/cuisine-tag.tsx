import { cn } from "@/lib/utils";

interface CuisineTagProps {
  label: string;
  className?: string;
  borderColor?: string;
  textColor?: string;
}

export function CuisineTag({ label, className, borderColor = "#DDE5DC", textColor = "#8A968B" }: CuisineTagProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest",
        className
      )}
      style={{ borderColor, color: textColor }}
    >
      {label}
    </span>
  );
}
