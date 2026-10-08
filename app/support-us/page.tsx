import type { Metadata } from "next";
import { SupportContent } from "./support-content";

export const metadata: Metadata = {
  title: "Support us | BiteSite",
  description: "Ways to support BiteSite are coming soon.",
  robots: { index: false, follow: true },
};

export default function SupportUsPage() {
  return (
    <main className="min-h-screen bg-page px-4 py-12 text-center text-ink sm:py-20">
      <SupportContent />
    </main>
  );
}
