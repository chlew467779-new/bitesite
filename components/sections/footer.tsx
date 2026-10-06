/* bitesite/components/sections/footer.tsx */

import { BiteSiteLogo } from "@/components/ui/bitesite-logo";
import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/stories", label: "Stories" },
  { href: "/jobs", label: "Jobs" },
  { href: "/join-us", label: "For restaurants" },
  { href: "/merchant/login", label: "Merchant login" },
  { href: "/feedback", label: "Feedback" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 pt-6 md:flex-row md:items-center md:justify-between">
        <BiteSiteLogo showTagline={true} size="small" />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center text-ink-2 transition-colors hover:text-brand"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted" suppressHydrationWarning>
          © {new Date().getFullYear()} BiteSite
        </p>
      </div>
    </footer>
  );
}
