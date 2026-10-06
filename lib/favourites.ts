/* bitesite/lib/favourites.ts */

"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Saved restaurants (R6): a list of store slugs in this browser's local storage. Nothing is sent
 * to BiteSite (privacy policy §5). Storage can be blocked or full, so every access is guarded and
 * the heart simply does nothing lasting in that case.
 */
const KEY = "bitesite.favourites";
const CHANGE = "bitesite:favourites";
const MAX = 200;
const EMPTY: readonly string[] = Object.freeze([]);

let cachedRaw: string | null = null;
let cachedList: readonly string[] = EMPTY;

function read(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cachedList;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed)
      ? Object.freeze(parsed.filter((slug): slug is string => typeof slug === "string").slice(0, MAX))
      : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(list: readonly string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Storage unavailable: the change lasts only until the page closes.
    cachedRaw = null;
    cachedList = Object.freeze([...list]);
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Saved slugs, newest first. Empty on the server and during hydration. */
export function useFavourites() {
  const slugs = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((slug: string) => {
    const current = read();
    write(current.includes(slug) ? current.filter((s) => s !== slug) : [slug, ...current]);
  }, []);
  return { slugs, isSaved: (slug: string) => slugs.includes(slug), toggle };
}
