/* bitesite/components/sections/share-menu.tsx */

"use client";

import { useState } from "react";
import { Check, Copy, Link2, MessageCircle, Facebook, Twitter, Instagram, X } from "lucide-react";

interface ShareMenuProps {
  slug: string;
  name: string;
}

export function ShareMenu({ slug, name }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
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
    { icon: <MessageCircle className="h-3.5 w-3.5" />, href: `https://wa.me/?text=${encodedName}%20${encodedUrl}`, color: "text-green-600 hover:bg-green-50", label: "WhatsApp" },
    { icon: <Facebook className="h-3.5 w-3.5" />, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, color: "text-blue-600 hover:bg-blue-50", label: "Facebook" },
    { icon: <Twitter className="h-3.5 w-3.5" />, href: `https://twitter.com/intent/tweet?text=${encodedName}&url=${encodedUrl}`, color: "text-sky-500 hover:bg-sky-50", label: "Twitter" },
  ];

  return (
    <div className="relative" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm border border-white/20 transition-all hover:bg-black/50 active:scale-90"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {open ? <X className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      </button>
      
      {open && (
        <div className="absolute right-0 top-9 z-50 flex items-center gap-1 rounded-lg bg-white/95 backdrop-blur-md border border-gray-200 p-1.5 shadow-xl">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-gray-700" />}
          </button>
          {links.map((l, i) => (
            <a
              key={i}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${l.color}`}
              onClick={(e) => e.stopPropagation()}
              title={l.label}
            >
              {l.icon}
            </a>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-pink-600 hover:bg-pink-50 transition-colors"
            title="Copy for Instagram"
          >
            <Instagram className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
