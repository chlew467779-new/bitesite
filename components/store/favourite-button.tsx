/* bitesite/components/store/favourite-button.tsx */

"use client";

import { Heart } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useFavourites } from "@/lib/favourites";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Heart that saves a restaurant on this device (R6). Used on cards and the store cover. */
export function FavouriteButton({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const t = useT();
  const { isSaved, toggle } = useFavourites();
  const saved = isSaved(slug);
  return (
    <IconButton
      variant="overlay"
      label={saved ? t("saved.removeName", { name }) : t("saved.saveName", { name })}
      aria-pressed={saved}
      onClick={(event) => {
        // Cards sit inside links; the heart must not open the restaurant.
        event.preventDefault();
        event.stopPropagation();
        toggle(slug);
      }}
      className={className}
    >
      <Heart size={20} aria-hidden className={cn(saved ? "fill-[#D93F3F] text-[#D93F3F]" : "text-ink")} />
    </IconButton>
  );
}
