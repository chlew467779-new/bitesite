"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import type { StyleConfig } from "@/lib/styles";

interface DiscoverBiteSiteProps {
  style: StyleConfig;
}

export function DiscoverBiteSite({ style }: DiscoverBiteSiteProps) {
  return (
    <div className="px-4 py-6 text-center" style={{ backgroundColor: style.bg }}>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs transition-all duration-300 hover:opacity-80"
        style={{ borderColor: style.border, color: style.muted }}
      >
        <Home className="h-3.5 w-3.5" />
        Discover more restaurants on BiteSite
      </Link>
    </div>
  );
}
