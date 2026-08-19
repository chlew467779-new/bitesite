/* bitesite/app/our-partner/page.tsx */

import { getMerchantsForMap } from "@/lib/supabase";
import { MapContainer } from "@/components/sections/map-container";

export const revalidate = 300;

export default async function OurPartnerPage() {
  const merchants = await getMerchantsForMap();

  return (
    <main className="flex flex-col h-[calc(100dvh-53px)]">
      <MapContainer merchants={merchants} />
    </main>
  );
}
