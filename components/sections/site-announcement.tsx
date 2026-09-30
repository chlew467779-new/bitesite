"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

/**
 * Homepage pop-up (CH 2026-09-29). Admin posts it; a visitor sees each pop-up once and can close it
 * with the large X, the Close button, the backdrop or Esc. Closed pop-ups are remembered in this
 * browser only; if storage is blocked the pop-up simply shows again next visit.
 * An image with no title, text or button is shown as a poster: the whole picture, nothing else.
 */

type Announcement = {
  id: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
};

const CLOSED_KEY = "bitesite.popup.closed";
const readClosed = () => { try { return window.localStorage.getItem(CLOSED_KEY); } catch { return null; } };
const saveClosed = (id: string) => { try { window.localStorage.setItem(CLOSED_KEY, id); } catch { /* storage unavailable */ } };

export function SiteAnnouncement() {
  const [item, setItem] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    supabase
      .from("site_announcements")
      .select("id,title,body,image_url,link_url,link_label")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Announcement>()
      .then(({ data }) => {
        if (!live || !data || readClosed() === data.id) return;
        setItem(data);
        // A short pause so the page is readable before the pop-up appears.
        timer = setTimeout(() => { if (live) { returnFocus.current = document.activeElement; setOpen(true); } }, 800);
      });
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, []);

  const close = useCallback(() => {
    if (item) saveClosed(item.id);
    setOpen(false);
    if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus();
  }, [item]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open, close]);

  if (!open || !item) return null;
  const headingId = `popup-${item.id}`;
  const posterOnly = Boolean(item.image_url) && !item.title && !item.body && !(item.link_url && item.link_label);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={item.title ? headingId : undefined}
        aria-label={item.title ? undefined : "Announcement"}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#E2E8E0] bg-white/95 text-[#2C3E2D] shadow-md transition-transform active:scale-95"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <X size={22} strokeWidth={2.25} />
        </button>

        {item.image_url && (
          // Natural proportions: the whole poster or photo shows, never cropped or boxed into a square.
          <Image src={item.image_url} alt={item.title ?? "Announcement"} width={800} height={1000} sizes="(max-width: 640px) 100vw, 384px"
            className={`block h-auto w-full bg-[#F0F4EC] object-contain ${posterOnly ? "max-h-[calc(100dvh-2rem)]" : "max-h-[60dvh]"}`} />
        )}

        {!posterOnly && <div className={`space-y-3 p-5 ${item.image_url ? "" : "pr-16"}`}>
          {item.title && <h2 id={headingId} className="text-lg font-semibold leading-snug text-[#2C3E2D]">{item.title}</h2>}
          {item.body && <p className="whitespace-pre-line text-sm leading-relaxed text-[#5C6B5D]">{item.body}</p>}
          {item.link_url && item.link_label && (
            <a href={item.link_url} onClick={() => { if (item) saveClosed(item.id); }}
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#5A8F6E] px-5 text-sm font-medium text-white transition-colors hover:bg-[#4A7A5C]">
              {item.link_label}
            </a>
          )}
          <button type="button" onClick={close} className="flex min-h-11 w-full items-center justify-center rounded-full text-sm font-medium text-[#5C6B5D] hover:bg-[#F0F4EC]">
            Close
          </button>
        </div>}
      </div>
    </div>
  );
}
