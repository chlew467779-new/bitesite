"use client";

import Link from "next/link";
import { ReportProblem } from "@/app/components/report-problem";
import { useLang, useT } from "@/lib/i18n";

interface ClosedStoreProps {
  merchant: { slug: string; name: string };
  temporarilyClosed: boolean;
  closure: { note: string | null; reopen_on: string | null } | null;
  relatedMerchants: { slug: string; name: string; cuisine_type: string | null }[];
  footerText: string;
}

const DATE_LOCALES = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" } as const;

// Server reads remain in the route; only public display fields cross this boundary.
export function ClosedStore({ merchant, temporarilyClosed, closure, relatedMerchants, footerText }: ClosedStoreProps) {
  const t = useT();
  const lang = useLang();
  const formattedReopenOn = closure?.reopen_on
    ? new Date(`${closure.reopen_on}T00:00:00Z`).toLocaleDateString(DATE_LOCALES[lang], { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })
    : null;
  const ordersText = t("store.closed.orders", { name: "\uFFF0" }).split("\uFFF0");
  const reopenText = t("store.closed.reopen", { date: "\uFFF0" }).split("\uFFF0");
  return (
  <div className="min-h-screen bg-[#FAFBF7] flex flex-col">
    <div className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 text-6xl">{temporarilyClosed ? "🌙" : "😔"}</div>
        <h1 className="text-2xl font-bold text-[#2C3E2D] mb-3">
          {temporarilyClosed ? t("store.closed.temporary", { name: merchant.name }) : t("store.closed.unavailable")}
        </h1>
        {temporarilyClosed ? (
          <div className="mb-8 space-y-2 text-[#6B6560]">
            {closure?.note && <p className="whitespace-pre-wrap break-words rounded-xl bg-amber-50 p-4 text-amber-900">{closure.note}</p>}
            <p>{formattedReopenOn ? <>{reopenText[0]}<strong>{formattedReopenOn}</strong>{reopenText[1]}</> : t("store.closed.checkBack")}</p>
          </div>
        ) : (
          <>
          <p className="text-[#6B6560] mb-2">
            {ordersText[0]}<strong>{merchant.name}</strong>{ordersText[1]}
          </p>
          <p className="text-[#6B6560] mb-8">
            {t("store.closed.reservations")}
          </p>
          </>
        )}
        {relatedMerchants.length > 0 && (
          <div className="border-t border-[#DDE5DC] pt-8">
            <p className="text-sm font-medium text-[#8A968B] mb-4">
              {t("store.closed.explore")}
            </p>
            <div className="space-y-3">
              {relatedMerchants.map((m) => (
                <Link
                  key={m.slug}
                  href={`/store/${m.slug}`}
                  className="block p-4 bg-white rounded-xl border border-[#DDE5DC] hover:border-[#5A8F6E] transition-colors text-left"
                >
                  <h3 className="font-semibold text-[#2C3E2D]">{m.name}</h3>
                  <p className="text-sm text-[#8A968B]">{m.cuisine_type}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-[#5A8F6E] font-medium hover:text-[#4A7A5E] transition-colors"
          >
            ← {t("store.back")}
          </Link>
        </div>
        <ReportProblem targetType="merchant" slug={merchant.slug} />
      </div>
    </div>
    <footer className="py-8 px-4 text-center border-t border-[#DDE5DC]">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-[#8A968B] hover:text-[#5A8F6E] transition-colors"
      >
        {footerText}
      </Link>
      <Link href="/feedback" className="mt-1 flex min-h-11 items-center justify-center text-sm text-[#5A8F6E] underline">{t("store.feedback")}</Link>
    </footer>
  </div>
  );
}
