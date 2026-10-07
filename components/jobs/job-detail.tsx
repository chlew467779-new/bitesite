"use client";

import Link from "next/link";
import { useT, type MessageKey } from "@/lib/i18n";
import type { PublicJob } from "@/lib/jobs-public";

const TYPE_KEYS: Record<PublicJob["jobType"], MessageKey> = {
  full_time: "jobs.fullTime", part_time: "jobs.partTime", temporary: "jobs.temporary",
};

// All application URLs are built on the server. The outgoing WhatsApp text stays in English.
export function JobDetail({ job, restaurantUrl, applyHref, phone }: {
  job: PublicJob; restaurantUrl: string; applyHref: string | null; phone: string;
}) {
  const t = useT();
  return (
  <article className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
    <Link href="/jobs" className="inline-flex min-h-11 items-center text-sm text-brand underline">← {t("jobs.detail.back")}</Link>
    <div className="mt-5 rounded-[20px] border border-line bg-page p-5 sm:p-8">
      <p className="text-sm font-medium text-brand">{t(TYPE_KEYS[job.jobType])}</p>
      <h1 className="mt-2 text-3xl font-semibold break-words sm:text-4xl">{job.title}</h1>
      <Link href={restaurantUrl} className="mt-3 inline-flex min-h-11 items-center font-medium text-brand underline">{job.restaurant.name}</Link>
      {job.restaurant.area && <p className="text-sm text-muted">{job.restaurant.area}</p>}

      <dl className="mt-7 grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-2">
        <div><dt className="font-medium">{t("jobs.detail.hours")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted">{job.hours}</dd></div>
        {job.salary && <div><dt className="font-medium">{t("jobs.detail.pay")}</dt><dd className="mt-1 break-words text-muted">{job.salary}</dd></div>}
      </dl>

      <h2 className="mt-7 text-xl font-semibold">{t("jobs.detail.about")}</h2>
      <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-ink-2">{job.description}</p>

      <div className="mt-8 rounded-lg bg-brand-soft p-4">
        <p className="text-sm text-ink-2">{t("jobs.intro")}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {applyHref && <a href={applyHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-medium text-white">{t("jobs.detail.apply")}</a>}
          {phone && <a href={`tel:+${phone}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand px-5 text-sm font-medium text-brand">{t("jobs.detail.call")}</a>}
          {!applyHref && !phone && <Link href={restaurantUrl} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand px-5 text-sm font-medium text-brand">{t("jobs.detail.restaurant")}</Link>}
        </div>
      </div>
    </div>
  </article>
  );
}
