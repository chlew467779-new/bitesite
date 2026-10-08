"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Moon, Store } from "lucide-react";
import { ReportProblem } from "@/app/components/report-problem";
import { Footer } from "@/components/sections/footer";
import { SafeImage } from "@/app/components/safe-image";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonClasses } from "@/components/ui/button";
import { presetLabel, useLang, useT } from "@/lib/i18n";

interface ClosedStoreProps {
  merchant: { slug: string; name: string };
  temporarilyClosed: boolean;
  closure: { note: string | null; reopen_on: string | null } | null;
  relatedMerchants: { slug: string; name: string; cuisine_type: string | null; area: string | null; cover_image: string | null }[];
}

const DATE_LOCALES = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" } as const;

/**
 * Page for a restaurant that is closed for now or no longer listed. It says so plainly, shows the
 * owner's note and reopening date, and offers other restaurants nearby. Server reads stay in the
 * route; only public display fields cross this boundary.
 */
export function ClosedStore({ merchant, temporarilyClosed, closure, relatedMerchants }: ClosedStoreProps) {
  const t = useT();
  const lang = useLang();
  const reopenOn = closure?.reopen_on
    ? new Date(`${closure.reopen_on}T00:00:00Z`).toLocaleDateString(DATE_LOCALES[lang], { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })
    : null;
  const Icon = temporarilyClosed ? Moon : Store;

  return (
    <div className="min-h-screen bg-page">
      <main className="mx-auto max-w-md px-4 pb-6 pt-10 sm:pt-16">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface text-ink-2"><Icon className="size-6" /></span>
        <StatusPill tone="closed" className="mt-5">{temporarilyClosed ? t("store.closed.temporaryPill") : t("store.closed.unavailablePill")}</StatusPill>
        {/* The pill above says why; the heading is just the restaurant people were looking for. */}
        <h1 className="mt-3 break-words text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-ink">{merchant.name}</h1>

        {temporarilyClosed ? (
          <div className="mt-4 space-y-3 text-[15px] text-ink-2">
            {closure?.note && <p className="whitespace-pre-wrap break-words rounded-[16px] bg-surface p-4 text-ink">{closure.note}</p>}
            <p>{reopenOn ? t("store.closed.reopen", { date: reopenOn }) : t("store.closed.checkBack")}</p>
          </div>
        ) : (
          <p className="mt-4 text-[15px] text-ink-2">{t("store.closed.body", { name: merchant.name })}</p>
        )}

        {relatedMerchants.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-[-0.02em] text-ink">{t("store.closed.explore")}</h2>
            <ul className="mt-3 space-y-2">
              {relatedMerchants.map((m) => (
                <li key={m.slug}>
                  <Link href={`/store/${m.slug}`} className="flex items-center gap-3 rounded-[16px] border border-line p-2.5 transition-colors hover:bg-surface">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-[12px] bg-surface">
                      {m.cover_image && <SafeImage src={m.cover_image} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-ink">{m.name}</span>
                      <span className="block truncate text-sm text-muted">{[m.cuisine_type && presetLabel(lang, m.cuisine_type), m.area].filter(Boolean).join(" · ")}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href="/" className={`mt-8 ${buttonClasses({ variant: "secondary", size: "lg", block: true })}`}>
          <ArrowLeft className="size-4" />{t("store.back")}
        </Link>
      </main>
      <ReportProblem targetType="merchant" slug={merchant.slug} className="mx-auto max-w-md px-4 pb-10" />
      <Footer />
    </div>
  );
}
