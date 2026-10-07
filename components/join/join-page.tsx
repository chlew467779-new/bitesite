/* bitesite/components/join/join-page.tsx */

"use client";

import Link from "next/link";
import { Check, ChevronDown, MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { BITESITE_WHATSAPP_URL } from "@/lib/whatsapp";
import { useLang, useT, type MessageKey } from "@/lib/i18n";

const STEPS = [1, 2, 3, 4] as const;
const FEATURES: MessageKey[] = ["join.feature.menu", "join.feature.dashboard", "join.feature.stories", "join.feature.stats"];
const FAQS = ["free", "contribute", "promote", "app", "update", "join", "menu"] as const;
const NUMBER_LOCALES = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" } as const;

/**
 * Join Us (R10, wording from ChatGPT G33). Phone first: one promise, the steps, what is included,
 * the price, questions, then the same two actions again at the end.
 */
export function JoinPage({ partnerCount, intake }: { partnerCount: number | null; intake: "paused" | "full" | "busy" | null }) {
  const t = useT();
  const lang = useLang();
  const create = (
    <Link href="/merchant/login?mode=register" className={buttonClasses({ variant: "kaya", size: "xl" })}>
      {t("join.create")}
    </Link>
  );
  const ask = (
    <a href={BITESITE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", size: "xl" })}>
      <MessageCircle size={18} aria-hidden />{t("join.ask")}
    </a>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-4">
      <section className="flex flex-col gap-3 pb-2 pt-5 md:pt-10">
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-[40px]">{t("join.title")}</h1>
        <p className="text-[15px] leading-normal text-ink-2 md:text-base">{t("join.intro")}</p>
        {partnerCount !== null && (
          <p className="text-sm font-semibold text-brand">{t("join.count", { count: partnerCount.toLocaleString(NUMBER_LOCALES[lang]) })}</p>
        )}
        {intake && (
          <p role="status" className="rounded-2xl bg-soldout-bg p-4 text-sm text-soldout">
            {t(intake === "paused" ? "join.paused" : intake === "full" ? "join.full" : "join.busy")}
          </p>
        )}
        <div className="flex flex-col gap-2 pt-1 sm:flex-row">{create}{ask}</div>
      </section>

      <section aria-labelledby="join-how" className="pt-8">
        <SectionTitle id="join-how">{t("join.how")}</SectionTitle>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2">
          {STEPS.map((n) => (
            <li key={n} className="flex gap-3 rounded-[20px] bg-surface p-4">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-on-brand">{n}</span>
              <span>
                <span className="block text-[15px] font-bold">{t(`join.step${n}.title` as MessageKey)}</span>
                <span className="mt-0.5 block text-sm text-muted">{t(`join.step${n}.body` as MessageKey)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="join-included" className="pt-8">
        <SectionTitle id="join-included">{t("join.included")}</SectionTitle>
        <ul className="mt-3 space-y-2">
          {FEATURES.map((key) => (
            <li key={key} className="flex items-start gap-3 text-[15px] text-ink-2">
              <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Check size={13} strokeWidth={3} /></span>
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="join-price" className="pt-8">
        <div className="rounded-3xl bg-brand p-5 text-on-brand md:p-7">
          <h2 id="join-price" className="text-xl font-extrabold tracking-[-0.02em]">{t("join.price.title")}</h2>
          <p className="mt-2 text-[15px] text-[#D5E5DA]">{t("join.price.body")}</p>
          <p className="mt-1 text-[15px] text-[#D5E5DA]">{t("join.price.contribution")}</p>
        </div>
      </section>

      <section aria-labelledby="join-faq" className="pt-8">
        <SectionTitle id="join-faq">{t("join.faq")}</SectionTitle>
        <div className="mt-3 divide-y divide-line overflow-hidden rounded-[20px] border border-line">
          {FAQS.map((id) => (
            <details key={id} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                {t(`join.faq.${id}.q` as MessageKey)}
                <ChevronDown size={18} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-4 pb-4 text-[15px] leading-normal text-ink-2">{t(`join.faq.${id}.a` as MessageKey)}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 pt-8 sm:flex-row">{create}{ask}</div>
    </div>
  );
}
