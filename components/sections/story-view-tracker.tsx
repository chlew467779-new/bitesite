/* bitesite/components/sections/story-view-tracker.tsx */

"use client";

import { useEffect } from "react";

export function StoryViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/story-view", {
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
