"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

/** Records one menu exposure when the menu section becomes meaningfully visible. */
export function MenuViewTracker({ slug, sectionId = "menu-section" }: { slug: string; sectionId?: string }) {
  const tracked = useRef(false);

  useEffect(() => {
    const section = document.getElementById(sectionId);
    if (!section || tracked.current) return;

    if (typeof IntersectionObserver === "undefined") {
      tracked.current = true;
      trackEvent("menu_view", { slug, pageType: "merchant" });
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || tracked.current) return;
      tracked.current = true;
      observer.disconnect();
      trackEvent("menu_view", { slug, pageType: "merchant" });
    }, { threshold: 0.25 });

    observer.observe(section);
    return () => observer.disconnect();
  }, [sectionId, slug]);

  return null;
}
