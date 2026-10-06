/* bitesite/components/sections/site-header.tsx */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BiteSiteLogo } from "@/components/ui/bitesite-logo";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/our-partner", label: "Our Partner" },
  { href: "/stories", label: "Stories" },
  { href: "/jobs", label: "Jobs" },
  { href: "/join-us", label: "Join Us" },
  { href: "/merchant/login", label: "Merchant login" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // 商家页不显示导航栏
  // Admin has its own shell and header.
  if (pathname?.startsWith("/store/") || pathname?.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="inline-flex min-h-11 items-center" aria-label="BiteSite home">
          <BiteSiteLogo showTagline={false} size="small" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                  isActive ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface md:hidden"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      <div
        className={`overflow-hidden border-line bg-white transition-all duration-300 md:hidden ${
          menuOpen ? "max-h-[420px] border-t opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-4 py-3">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive ? "page" : undefined}
                tabIndex={menuOpen ? undefined : -1}
                className={`flex min-h-12 items-center rounded-[14px] px-4 text-base font-semibold transition-colors ${
                  isActive ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
