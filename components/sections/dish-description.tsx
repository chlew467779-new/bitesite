"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Keep two-line previews, but only offer expansion when text actually overflows. */
export function DishDescription({ description, className = "", clamp = true }: { description: string; className?: string; clamp?: boolean }) {
  const id = useId();
  const probe = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const node = probe.current;
    if (!node || !clamp) return;
    let cancelled = false;
    const measure = () => {
      if (!cancelled) setTruncated(node.scrollHeight > node.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    void document.fonts.ready.then(measure);
    return () => { cancelled = true; observer.disconnect(); };
  }, [description, clamp]);

  const showFull = !clamp || (expanded && truncated);
  const textClass = `${className} whitespace-pre-line break-words`;
  return (
    <div className="relative min-w-0">
      {/* A separate, inaccessible probe stays clamped while the visible text is expanded. */}
      {clamp && <p ref={probe} aria-hidden="true" className={`${textClass} line-clamp-2 invisible pointer-events-none absolute inset-x-0 top-0`}>
        {description}
      </p>}
      <p id={id} className={`${textClass} ${showFull ? "" : "line-clamp-2"}`}>{description}</p>
      {clamp && truncated && (
        <button type="button" aria-expanded={showFull} aria-controls={id}
          onClick={() => setExpanded(!showFull)}
          className="inline-flex min-h-11 items-center px-2 text-xs underline underline-offset-4">
          {showFull ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
