import Link from "next/link";
import { SafeImage } from "@/app/components/safe-image";
import { SectionTitle } from "@/components/ui/card";
import { formatDistanceKm } from "@/lib/nearby-core.mjs";

export type NearbyRestaurant = { slug: string; name: string; cuisine: string | null; distanceKm?: number; image?: string | null };

/**
 * "Nearby restaurants" on the restaurant page (G19). Measured from this restaurant's own
 * coordinates on the server (never the visitor's location); omitted when the restaurant has no
 * coordinates or no other public restaurant is within 5 km.
 */
export function NearbyRestaurants({ items, title = "Nearby restaurants", headingId = "nearby-heading" }: { items: NearbyRestaurant[]; title?: string; headingId?: string }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-5xl px-4 pt-7">
      <SectionTitle id={headingId}>{title}</SectionTitle>
      <ul className="mt-2 grid gap-x-8 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.slug}>
            <Link href={`/store/${item.slug}`} className="flex min-h-16 items-center gap-3 py-1.5 text-ink">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-[14px] bg-surface">
                {item.image ? (
                  <SafeImage src={item.image} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <span aria-hidden className="flex h-full items-center justify-center text-xl font-extrabold text-muted opacity-50">{item.name.charAt(0)}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-bold">{item.name}</span>
                {item.cuisine && <span className="mt-0.5 block break-words text-[13px] text-muted">{item.cuisine}</span>}
              </span>
              {item.distanceKm != null && <span className="shrink-0 text-sm font-bold text-brand">{formatDistanceKm(item.distanceKm)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
