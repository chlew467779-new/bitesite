/* bitesite/app/apple-icon.tsx */

/** Home-screen icon (iPhone "Add to Home Screen") and the logo in structured data. */

import { ImageResponse } from "next/og";
import { BRAND, LeafMark } from "@/lib/og-brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.paper }}>
        <LeafMark size={150} />
      </div>
    ),
    size,
  );
}
