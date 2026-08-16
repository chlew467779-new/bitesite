"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/stories", label: "Stories" },
  { href: "/join-us", label: "Join Us" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // 商家页不显示导航栏
  if (pathname?.startsWith("/store/")) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#DDE5DC] bg-[#FAFBF7]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="font-serif text-lg font-semibold tracking-wide text-[#2C3E2D]"
        >
          BiteSite
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#5A8F6E] text-white"
                    : "text-[#6B6560] hover:bg-[#5A8F6E]/10 hover:text-[#2C3E2D]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#2C3E2D] transition-colors hover:bg-[#5A8F6E]/10 md:hidden"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      <div
        className={`overflow-hidden border-t border-[#DDE5DC] bg-[#FAFBF7]/98 backdrop-blur-md transition-all duration-300 md:hidden ${
          menuOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col px-4 py-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#5A8F6E]/10 text-[#5A8F6E]"
                    : "text-[#6B6560] hover:bg-[#5A8F6E]/5 hover:text-[#2C3E2D]"
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
