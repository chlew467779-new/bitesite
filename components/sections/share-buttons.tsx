/* bitesite/components/sections/share-buttons.tsx */

"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { trackEvent } from '@/lib/analytics';

type LayoutVariant = "classic" | "elegant" | "minimal" | "modern" | "rustic";

interface ShareButtonsProps {
  slug: string;
  name: string;
  variant?: LayoutVariant;
}

const buttonStyles: Record<LayoutVariant, string> = {
  classic: "bg-white border-amber-200 text-amber-800 hover:bg-amber-50",
  elegant: "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700",
  minimal: "bg-white border-stone-200 text-stone-700 hover:bg-stone-50",
  modern: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
  rustic: "bg-white border-orange-200 text-orange-800 hover:bg-orange-50",
};

export function ShareButtons({ slug, name, variant = "classic" }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const url = `https://bitesite-pied.vercel.app/store/${slug}`;

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
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${buttonStyles[variant]}`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>

      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${buttonStyles[variant]}`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
