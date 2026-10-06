/* bitesite/components/ui/sheet.tsx */

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";

// Bottom sheet on phones, centred dialog from md up. Built on <dialog> so focus
// trapping, Esc and the backdrop come from the browser.
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-page p-0 text-ink backdrop:bg-black/40",
        "md:m-auto md:max-w-lg md:rounded-3xl",
        className
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-page px-4 py-2">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <IconButton label="Close" onClick={onClose}>
          <X size={22} />
        </IconButton>
      </div>
      <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
    </dialog>
  );
}
