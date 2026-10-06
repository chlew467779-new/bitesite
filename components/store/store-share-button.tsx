/* bitesite/components/store/store-share-button.tsx */

"use client";

import { useState } from "react";
import { Check, Share } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { trackEvent } from "@/lib/analytics";
import { getSiteUrl } from "@/lib/site-url";

/** Share icon on the store cover: the phone's share sheet, or copy the link where there is none. */
export function StoreShareButton({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${getSiteUrl()}/store/${slug}`;

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${name} on BiteSite`, text: `Check out ${name} on BiteSite!`, url });
        trackEvent("share", { pageType: "merchant", slug, detail: "native" });
      } catch {
        // Visitor closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent("share", { pageType: "merchant", slug, detail: "copy_link" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; nothing else to offer.
    }
  };

  return (
    <IconButton variant="overlay" label={copied ? "Link copied" : "Share"} onClick={share}>
      {copied ? <Check size={20} aria-hidden /> : <Share size={20} aria-hidden />}
    </IconButton>
  );
}
