/* bitesite/components/sections/view-tracker.tsx */

"use client";

import { useEffect } from "react";
import { isAnalyticsSuppressed } from "@/lib/analytics";

export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    // This one posts straight to /api/view (it bumps merchant_stats.view_count) rather than
    // going through trackEvent, so it needs the same non-recording-surface guard.
    if (isAnalyticsSuppressed()) return;

    const timer = setTimeout(() => {
      fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
        keepalive: true,
      }).catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [slug]);

  return null;
}
