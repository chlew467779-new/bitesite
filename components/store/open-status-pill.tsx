/* bitesite/components/store/open-status-pill.tsx */

"use client";

import { useSyncExternalStore } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { malaysiaMinutes, openStatus } from "@/lib/store-summary.mjs";

// The page is cached for up to a minute, so "open now" is worked out in the visitor's browser.
// On the server (and during hydration) the snapshot is null and nothing renders, so the
// server HTML and the first client render always agree.
function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}
const clientMinutes = () => malaysiaMinutes();
const serverMinutes = () => null;

export function OpenStatusPill({ todayHours, className }: { todayHours: string | null | undefined; className?: string }) {
  const minutes = useSyncExternalStore(subscribe, clientMinutes, serverMinutes);
  if (minutes === null) return null;
  const status = openStatus(todayHours, minutes);
  if (!status) return null;
  return (
    <StatusPill tone={status.open ? "open" : "closed"} dot={status.open} className={className}>
      {status.label}
    </StatusPill>
  );
}
