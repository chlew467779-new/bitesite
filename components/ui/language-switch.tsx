/* bitesite/components/ui/language-switch.tsx */

"use client";

import { useEffect, useState } from "react";
import { Check, Globe } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { LANGS, setLang, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SHORT = { en: "EN", zh: "中", ms: "BM" } as const;

/** Globe button that opens the language choice (R8). `overlay` for use on the store cover photo. */
export function LanguageSwitch({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const lang = useLang();
  const t = useT();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("lang.button")}
        title={t("lang.button")}
        className={cn(iconButtonClasses({ variant: overlay ? "overlay" : "plain" }), "w-auto min-w-11 gap-1 px-2.5 text-xs font-bold")}
      >
        <Globe size={18} aria-hidden />
        <span aria-hidden>{SHORT[lang]}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("lang.title")}>
        <ul className="space-y-2">
          {LANGS.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                lang={option.htmlLang}
                aria-pressed={lang === option.code}
                onClick={() => { setLang(option.code); setOpen(false); }}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between rounded-[14px] border px-4 text-base font-semibold",
                  lang === option.code ? "border-brand bg-brand-soft text-brand" : "border-line text-ink hover:bg-surface"
                )}
              >
                {option.label}
                {lang === option.code && <Check size={20} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">{t("lang.note")}</p>
      </Sheet>
    </>
  );
}

/** Keeps <html lang> in step with the chosen language (screen readers, Chinese line breaking). */
export function HtmlLangSync() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = LANGS.find((l) => l.code === lang)?.htmlLang ?? "en";
  }, [lang]);
  return null;
}
