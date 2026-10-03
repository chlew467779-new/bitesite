import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support us | BiteSite",
  description: "Ways to support BiteSite are coming soon.",
  robots: { index: false, follow: true },
};

export default function SupportUsPage() {
  return (
    <main className="min-h-screen bg-[#FAFBF7] px-4 py-12 text-center text-[#2C3E2D] sm:py-20">
      <p className="text-base leading-7">Ways to support BiteSite are coming soon.</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[#5A8F6E] underline underline-offset-4">
        Back to BiteSite
      </Link>
    </main>
  );
}
