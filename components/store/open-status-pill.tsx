/* bitesite/components/store/open-status-pill.tsx */

"use client";

import { useSyncExternalStore } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { malaysiaMinutes, openStatusParts } from "@/lib/store-summary.mjs";
import { formatTime, useLang, useT } from "@/lib/i18n";

// The page is cached for up to a minute, so "open now" is worked out in the visitor's browser.
// On the server (and during hydration) the snapshot is null and nothing renders, so the
// server HTML and the first client render always agree.
function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}
const clientMinutes = () => malaysiaMinutes();
const serverMinutes = () => null;

export function OpenStatusPill({
  todayHours,
  className,
  onPhoto = false,
}: {
  todayHours: string | null | undefined;
  className?: string;
  /** White pill for use over a photo (home cards). */
  onPhoto?: boolean;
}) {
  const minutes = useSyncExternalStore(subscribe, clientMinutes, serverMinutes);
  const lang = useLang();
  const t = useT();
  if (minutes === null) return null;
  const status = openStatusParts(todayHours, minutes);
  if (!status) return null;
  const time = status.minutes === null ? "" : formatTime(lang, status.minutes);
  const label = status.kind === "openUntil" ? t("status.openUntil", { time })
    : status.kind === "opensAt" ? t("status.opensAt", { time })
    : status.kind === "closedToday" ? t("status.closedToday") : t("status.closedNow");
  const tone = onPhoto ? "onPhoto" : status.open ? "open" : "closed";
  return (
    <StatusPill tone={tone} dot={status.open} className={onPhoto && !status.open ? `text-muted ${className ?? ""}` : className}>
      {label}
    </StatusPill>
  );
}
