/* bitesite/components/sections/footer.tsx */

"use client";

import { BiteSiteLogo } from "@/components/ui/bitesite-logo";
import Link from "next/link";
import { useT, type MessageKey } from "@/lib/i18n";

const footerLinks: { href: string; label: MessageKey }[] = [
  { href: "/", label: "nav.home" },
  { href: "/stories", label: "nav.stories" },
  { href: "/jobs", label: "nav.jobs" },
  { href: "/join-us", label: "footer.forRestaurants" },
  { href: "/merchant/login", label: "nav.login" },
  { href: "/feedback", label: "footer.feedback" },
  { href: "/privacy", label: "footer.privacy" },
  { href: "/terms", label: "footer.terms" },
];

export function Footer() {
  const t = useT();
  return (
    <footer className="mt-12 border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 pt-6 md:flex-row md:items-center md:justify-between">
        <BiteSiteLogo showTagline={true} size="small" />
        <nav aria-label={t("footer.label")} className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-ink-2 transition-colors hover:text-brand"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {t(link.label)}
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
