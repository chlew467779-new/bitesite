/* bitesite/app/store/[merchant]/opengraph-image.tsx */

/**
 * Restaurant share card: name, cuisine and area on BiteSite's brand. This is what WhatsApp shows
 * when someone shares a restaurant page. Only public restaurants are read (row level security);
 * anything else gets the plain BiteSite card. Chinese and other non-Latin names load a subset font.
 */

import { ImageResponse } from "next/og";
import { getMerchantBySlug } from "@/lib/supabase";
import { BRAND, LeafMark, OG_SIZE, cardFonts, hasFont } from "@/lib/og-brand";

export const alt = "Restaurant on BiteSite";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

type Props = { params: Promise<{ merchant: string }> };

export default async function Image({ params }: Props) {
  const { merchant: slug } = await params;
  const merchant = slug ? await getMerchantBySlug(slug) : null;
  const name = merchant?.name ?? "BiteSite";
  const cuisine = (merchant?.cuisine?.length ? merchant.cuisine : merchant?.cuisine_type ? [merchant.cuisine_type] : []).slice(0, 3);
  const details = [cuisine.join(" · "), merchant?.area].filter(Boolean).join("  |  ");
  const line = merchant ? "Menu, opening hours and WhatsApp on BiteSite" : "Discover local restaurants and their stories";

  const fonts = await cardFonts({ body: `${name}${details}${line}`, wordmark: "BiteSite", cjk: `${name}${details}` });
  // Name and details use the CJK subset when the name needs it (it also covers their Latin letters).
  const nameFont = hasFont(fonts, "CJK") ? "CJK" : "Body";
  const nameSize = name.length > 28 ? 64 : name.length > 18 ? 80 : 96;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BRAND.paper, padding: "64px 80px", borderBottom: `24px solid ${BRAND.green}`, fontFamily: "Body" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <LeafMark size={72} />
          <div style={{ marginLeft: 20, fontSize: 44, fontWeight: 700, color: BRAND.ink, fontFamily: hasFont(fonts, "Wordmark") ? "Wordmark" : "Body" }}>BiteSite</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: nameSize, fontWeight: 700, color: BRAND.ink, lineHeight: 1.1, fontFamily: nameFont }}>{name}</div>
          {details && <div style={{ marginTop: 20, fontSize: 36, fontWeight: 700, color: BRAND.green, fontFamily: nameFont }}>{details}</div>}
        </div>
        <div style={{ fontSize: 30, color: BRAND.muted }}>{line}</div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
