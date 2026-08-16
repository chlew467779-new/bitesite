/* bitesite/components/sections/share-buttons.tsx */

"use client";

import { useState } from "react";
import { Check, Copy, Link2, MessageCircle, Facebook, Twitter, Instagram } from "lucide-react";

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
  const encodedUrl = encodeURIComponent(url);
  const encodedName = encodeURIComponent(`Check out ${name} on BiteSite!`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const links = [
    { icon: <MessageCircle className="h-3.5 w-3.5" />, href: `https://wa.me/?text=${encodedName}%20${encodedUrl}`, color: "text-green-600" },
    { icon: <Facebook className="h-3.5 w-3.5" />, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, color: "text-blue-600" },
    { icon: <Twitter className="h-3.5 w-3.5" />, href: `https://twitter.com/intent/tweet?text=${encodedName}&url=${encodedUrl}`, color: "text-sky-500" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${buttonStyles[variant]}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
      {links.map((l, i) => (
        <a
          key={i}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center rounded-full border w-8 h-8 transition-all active:scale-95 ${buttonStyles[variant]} ${l.color}`}
        >
          {l.icon}
        </a>
      ))}
      <button
        onClick={handleCopy}
        className={`inline-flex items-center justify-center rounded-full border w-8 h-8 transition-all active:scale-95 ${buttonStyles[variant]} text-pink-600`}
        title="Copy for Instagram"
      >
        <Instagram className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
