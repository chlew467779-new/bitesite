import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatDistanceKm } from "@/lib/nearby-core.mjs";

export type NearbyRestaurant = { slug: string; name: string; cuisine: string | null; distanceKm: number };

/**
 * "Nearby restaurants" on the restaurant page (G19), shared by every page style. Measured from this
 * restaurant's own coordinates on the server (never the visitor's location); omitted when the
 * restaurant has no coordinates or no other public restaurant is within 5 km.
 */
export function NearbyRestaurants({ items }: { items: NearbyRestaurant[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="nearby-heading" className="bg-white px-4 py-10 text-[#2C3E2D] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h2 id="nearby-heading" className="text-2xl font-semibold">Nearby restaurants</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.slug}>
              <Link href={`/store/${item.slug}`} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-[#DDE5DC] bg-white p-4 hover:border-[#5A8F6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <span className="min-w-0">
                  <span className="block font-semibold break-words">{item.name}</span>
                  {item.cuisine && <span className="mt-1 block text-sm text-[#6B6560] break-words">{item.cuisine}</span>}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#5A8F6E]"><MapPin className="h-4 w-4" aria-hidden="true" />{formatDistanceKm(item.distanceKm)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
