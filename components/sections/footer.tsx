/* bitesite/components/sections/footer.tsx */

import { BiteSiteLogo } from "@/components/ui/bitesite-logo";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#DDE5DC] bg-[#FAFBF7]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center md:text-left">
            <BiteSiteLogo showTagline={true} size="default" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#6B6560]">
            <Link
              href="/"
              className="transition-colors duration-200 active:text-[#5A8F6E]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Home
            </Link>
            <Link
              href="/stories"
              className="transition-colors duration-200 active:text-[#5A8F6E]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Stories
            </Link>
            <Link
              href="/join-us"
              className="transition-colors duration-200 active:text-[#5A8F6E]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Join Us
            </Link>
            <span className="text-[#DDE5DC]">|</span>
            <span className="text-[#8A968B]" suppressHydrationWarning>
              © {new Date().getFullYear()} BiteSite
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
