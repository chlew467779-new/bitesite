/**
 * Facilities ("Good to know") and occasions ("Great for") on the public restaurant page
 * (issue #4). The Owner chooses them in the dashboard; they show at once. Each layout passes the
 * classes of its own payment-methods block so the chips match the layout.
 */

"use client";

import { RETIRED_AMENITY_TAGS } from "@/lib/presets";
import { presetLabel, useLang, useT } from "@/lib/i18n";

type Props = {
  amenities?: string[] | null;
  occasion?: string[] | null;
  wrapperClass: string;
  labelClass: string;
  chipClass: string;
};

export function ListingTags({ amenities, occasion, wrapperClass, labelClass, chipClass }: Props) {
  const t = useT();
  const lang = useLang();
  const groups = [
    // Self-declared Halal / Pork-Free are never shown (see RETIRED_AMENITY_TAGS in lib/presets.ts).
    { label: t("store.goodToKnow"), tags: (amenities ?? []).filter((tag) => !RETIRED_AMENITY_TAGS.includes(tag)) },
    { label: t("store.greatFor"), tags: occasion ?? [] },
  ].filter((group) => group.tags.length > 0);
  if (groups.length === 0) return null;
  return (
    <div className={wrapperClass}>
      {groups.map((group, index) => (
        <div key={group.label} className={index > 0 ? "mt-4" : undefined}>
          <p className={labelClass}>{group.label}</p>
          <ul className="flex flex-wrap gap-2" aria-label={group.label}>
            {group.tags.map((tag) => (
              <li key={tag} className={chipClass}>{presetLabel(lang, tag)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
