/* bitesite/components/sections/share-buttons.tsx */

"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import { getSiteUrl } from '@/lib/site-url';
import type { LayoutKey } from "@/lib/layout-registry.mjs";
import { getLayoutTheme } from "@/lib/layout-theme.mjs";

type LayoutVariant = LayoutKey;

interface ShareButtonsProps {
  slug: string;
  name: string;
  variant?: LayoutVariant;
}

export function ShareButtons({ slug, name, variant = "classic" }: ShareButtonsProps) {
  const buttonStyles = getLayoutTheme(variant).share.button;
  const [copied, setCopied] = useState(false);
  const url = `${getSiteUrl()}/store/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent('share', { pageType: 'merchant', slug, detail: 'copy_link' });
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${name} on BiteSite`,
          text: `Check out ${name} on BiteSite!`,
          url: url,
        });
        trackEvent('share', { pageType: 'merchant', slug, detail: 'native' });
      } catch {
        // 用户取消，静默处理
      }
      return;
    }
    handleCopy();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleNativeShare}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${buttonStyles}`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>

      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${buttonStyles}`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
