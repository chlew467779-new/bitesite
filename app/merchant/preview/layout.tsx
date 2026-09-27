import type { Metadata } from "next";
import type { ReactNode } from "react";

// A private preview must never be indexed or shared as a page.
export const metadata: Metadata = {
  title: "Preview | BiteSite",
  robots: { index: false, follow: false },
};

export default function MerchantPreviewLayout({ children }: { children: ReactNode }) {
  return children;
}
