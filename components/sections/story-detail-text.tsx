"use client";

import { useLang, useT } from "@/lib/i18n";

export function StoryBackLabel() {
  const t = useT();
  return t("stories.back");
}

export function StoryRelatedHeading() {
  const t = useT();
  return t("stories.more");
}

export function StoryExpiredNotice() {
  const t = useT();
  return <div className="mx-auto max-w-3xl px-4 pt-6 text-sm font-medium text-amber-700">{t("stories.expired")}</div>;
}

const DATE_LOCALES = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" } as const;

export function StoryDate({ value }: { value: string }) {
  const lang = useLang();
  return <time dateTime={value}>{new Date(value).toLocaleDateString(DATE_LOCALES[lang], { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}</time>;
}
