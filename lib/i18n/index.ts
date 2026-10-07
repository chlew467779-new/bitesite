/* bitesite/lib/i18n/index.ts */

"use client";

import { useCallback, useSyncExternalStore } from "react";
import en from "./en.json";
import zh from "./zh.json";
import ms from "./ms.json";

/**
 * Interface language (R8): English, 简体中文, Bahasa Melayu. Only BiteSite's own fixed words are
 * translated (buttons, titles, hints); restaurants' names, menus and descriptions stay as written.
 * Text comes from ChatGPT G36 (keys, EN, 中文, BM); G30 reviews the translations.
 *
 * The choice lives in this browser's local storage (guarded: storage can be blocked). Pages are
 * cached and rendered in English on the server; useSyncExternalStore gives English during
 * hydration and the saved language right after, so server and first client render agree.
 */
export type Lang = "en" | "zh" | "ms";
export type MessageKey = keyof typeof en;

export const LANGS: readonly { code: Lang; label: string; htmlLang: string }[] = [
  { code: "en", label: "English", htmlLang: "en" },
  { code: "zh", label: "简体中文", htmlLang: "zh-Hans" },
  { code: "ms", label: "Bahasa Melayu", htmlLang: "ms" },
];

const DICTS: Record<Lang, Record<string, string>> = { en, zh, ms };
const KEY = "bitesite.lang";
const CHANGE = "bitesite:lang";

function readLang(): Lang {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "zh" || value === "ms" ? value : "en";
  } catch {
    return memoryLang;
  }
}
let memoryLang: Lang = "en";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) onChange(); };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setLang(lang: Lang) {
  memoryLang = lang;
  try { window.localStorage.setItem(KEY, lang); } catch { /* storage blocked: keep it for this page */ }
  document.documentElement.lang = LANGS.find((l) => l.code === lang)?.htmlLang ?? "en";
  window.dispatchEvent(new Event(CHANGE));
}

/** Fill {placeholders}: format("{count} restaurants", { count: 3 }). */
export function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Translate with an explicit language (for code that is not a component). */
export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>) {
  return format(DICTS[lang][key] ?? DICTS.en[key] ?? key, vars);
}

const LOCALES: Record<Lang, string> = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" };

/** Minutes after midnight → "3 pm" / "下午3:00" / "3:00 PTG" in the visitor's language. */
export function formatTime(lang: Lang, minutesOfDay: number) {
  const minutes = ((minutesOfDay % 1440) + 1440) % 1440;
  const date = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
  const whole = minutes % 60 === 0;
  if (lang === "en") {
    const h = Math.floor(minutes / 60);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${whole ? "" : `:${String(minutes % 60).padStart(2, "0")}`} ${h < 12 ? "am" : "pm"}`;
  }
  return new Intl.DateTimeFormat(LOCALES[lang], { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(date);
}

const DAY_INDEX: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

/** "monday" → "Monday" / "星期一" / "Isnin" (short: "Mon" / "周一" / "Isn"). */
export function dayName(lang: Lang, dayKey: string, short = false) {
  const index = DAY_INDEX[dayKey];
  if (index === undefined) return dayKey;
  const date = new Date(Date.UTC(2024, 0, 1 + index)); // 1 Jan 2024 was a Monday
  return new Intl.DateTimeFormat(LOCALES[lang], { weekday: short ? "short" : "long", timeZone: "UTC" }).format(date);
}

// Preset tags are stored as English values ("Pet Friendly", "Cash"); G36 gives each a key whose
// English text is that value. Restaurant-typed tags have no key and show as written.
const PRESET_KEYS = new Map(
  Object.entries(en as Record<string, string>)
    .filter(([key]) => /^(amenity|occasion|payment|preset)\./.test(key))
    .map(([key, value]) => [value.toLowerCase(), key as MessageKey]),
);

export function presetLabel(lang: Lang, value: string) {
  const key = PRESET_KEYS.get(value.toLowerCase());
  return key ? translate(lang, key) : value;
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, () => "en");
}

/** const t = useT(); t("home.title"); t("home.countMany", { count: 4 }) */
export function useT() {
  const lang = useLang();
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}
