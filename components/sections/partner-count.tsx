"use client";

import { useEffect, useState } from "react";

export function PartnerCount({ count }: { count: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let started: number | null = null;
    const animate = (now: number) => {
      if (started === null) started = now;
      const progress = Math.min((now - started) / 1000, 1);
      setDisplayed(Math.round(count * progress));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [count]);

  return (
    <section aria-label={`${count} restaurants have joined BiteSite`} className="bg-[#F0F4EC] px-4 py-8 text-center text-[#2C3E2D]">
      <p className="text-lg font-semibold sm:text-xl" aria-hidden="true">
        <span className="motion-reduce:hidden">{displayed.toLocaleString("en-MY")}</span>
        <span className="hidden motion-reduce:inline">{count.toLocaleString("en-MY")}</span>
        {" restaurants have joined BiteSite"}
      </p>
    </section>
  );
}
