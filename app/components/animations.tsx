/* bitesite/app/components/animations.tsx */

import type { ReactNode } from "react";

// Scroll fade-ins were removed in the 2026-10 redesign: on phones they left text faded
// until the observer fired, which looked like the page had stuck. These wrappers stay
// so older sections keep compiling; they render content immediately.

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
  once?: boolean;
}

export function FadeIn({ children, className = "" }: FadeInProps) {
  return <div className={className}>{children}</div>;
}

export function StaggerContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
