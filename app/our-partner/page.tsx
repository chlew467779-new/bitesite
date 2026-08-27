/* bitesite/app/our-partner/page.tsx */

import { getMerchantsForMap } from "@/lib/supabase";
import { MapContainer } from "@/components/sections/map-container";
import { PageViewTracker } from "@/app/components/page-view-tracker";

export const revalidate = 300;

export default async function OurPartnerPage() {
  const merchants = await getMerchantsForMap();

  return (
    <main className="flex flex-col h-[calc(100dvh-53px)]">
      <PageViewTracker pageType="our_partner" />
      <MapContainer merchants={merchants} />
    </main>
  );
}
