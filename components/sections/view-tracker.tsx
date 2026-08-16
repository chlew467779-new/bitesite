/* bitesite/components/sections/view-tracker.tsx */

"use client";

import { useEffect } from "react";

export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
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
