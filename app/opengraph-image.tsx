/* bitesite/app/opengraph-image.tsx */

/** Default share card (home, Stories list, Join us, …): what WhatsApp shows when a BiteSite link is pasted. */

import { ImageResponse } from "next/og";
import { BRAND, LeafMark, OG_SIZE, cardFonts, hasFont } from "@/lib/og-brand";

export const alt = "BiteSite: discover local restaurants and their stories";
export const size = OG_SIZE;
export const contentType = "image/png";

const TITLE = "BiteSite";
const TAGLINE = "Every Bite Tells a Story";
const LINE = "Find local restaurants: menus, opening hours and WhatsApp in one tap.";

export default async function Image() {
  const fonts = await cardFonts({ body: `${TAGLINE.toUpperCase()}${LINE}`, wordmark: TITLE });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: BRAND.paper, padding: 80, fontFamily: "Body" }}>
        <LeafMark size={150} />
        <div style={{ marginTop: 28, fontSize: 104, fontWeight: 700, color: BRAND.ink, fontFamily: hasFont(fonts, "Wordmark") ? "Wordmark" : "Body" }}>{TITLE}</div>
        <div style={{ marginTop: 8, fontSize: 30, letterSpacing: 8, textTransform: "uppercase", color: BRAND.green }}>{TAGLINE}</div>
        <div style={{ marginTop: 40, fontSize: 34, color: BRAND.muted, textAlign: "center", maxWidth: 900 }}>{LINE}</div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
