/* bitesite/app/icon.tsx */

/** Browser tab icon: the BiteSite leaf. */

import { ImageResponse } from "next/og";
import { LeafMark } from "@/lib/og-brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
        <LeafMark size={64} />
      </div>
    ),
    size,
  );
}
