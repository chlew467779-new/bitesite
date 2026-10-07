/* bitesite/components/jobs/jobs-list.tsx */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/ui/status-pill";
import { useLang, useT, type MessageKey } from "@/lib/i18n";
import type { PublicJob } from "@/lib/jobs-public";

const TYPES: { value: string; key: MessageKey }[] = [
  { value: "full_time", key: "jobs.fullTime" },
  { value: "part_time", key: "jobs.partTime" },
  { value: "temporary", key: "jobs.temporary" },
];
const DATE_LOCALES = { en: "en-MY", zh: "zh-Hans-MY", ms: "ms-MY" } as const;

/**
 * Jobs list (R10). Area and type are chips that combine; the choice stays in the address so a
 * filtered list can be shared (the server reads the same ?area= / ?type= on first load).
 */
export function JobsList({ jobs, initialArea, initialType }: { jobs: PublicJob[]; initialArea: string; initialType: string }) {
  const t = useT();
  const lang = useLang();
  const [area, setArea] = useState(initialArea);
  const [type, setType] = useState(initialType);
  const areas = [...new Set(jobs.map((job) => job.restaurant.area).filter((a): a is string => Boolean(a)))].sort((a, b) => a.localeCompare(b));
  const visible = jobs.filter((job) => (!area || job.restaurant.area === area) && (!type || job.jobType === type));

  const choose = (nextArea: string, nextType: string) => {
    setArea(nextArea);
    setType(nextType);
    const params = new URLSearchParams();
    if (nextArea) params.set("area", nextArea);
    if (nextType) params.set("type", nextType);
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `/jobs${query ? `?${query}` : ""}`);
  };
  const typeLabel = (value: string) => {
    const match = TYPES.find((item) => item.value === value);
    return match ? t(match.key) : value;
  };
  const posted = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t("jobs.recent")
      : t("jobs.posted", { date: date.toLocaleDateString(DATE_LOCALES[lang], { day: "numeric", month: "short", year: "numeric" }) });
  };

  return (
    <>
      <div className="space-y-3">
        {areas.length > 1 && (
          <div role="group" aria-label={t("jobs.area")} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            <Chip selected={!area} onClick={() => choose("", type)}>{t("jobs.allAreas")}</Chip>
            {areas.map((item) => <Chip key={item} selected={area === item} onClick={() => choose(item, type)}>{item}</Chip>)}
          </div>
        )}
        {/* Only four types, so they wrap instead of scrolling: every choice stays visible on a phone. */}
        <div role="group" aria-label={t("jobs.type")} className="flex flex-wrap gap-2">
          <Chip selected={!type} onClick={() => choose(area, "")}>{t("jobs.allTypes")}</Chip>
          {TYPES.map((item) => <Chip key={item.value} selected={type === item.value} onClick={() => choose(area, item.value)}>{t(item.key)}</Chip>)}
        </div>
      </div>

      <p className="mt-5 text-sm text-muted" role="status">{t(visible.length === 1 ? "jobs.countOne" : "jobs.count", { count: visible.length })}</p>

      {visible.length === 0 ? (
        <div className="mt-3 rounded-[20px] bg-surface p-8 text-center">
          <h2 className="text-lg font-bold">{t("jobs.empty.title")}</h2>
          <p className="mt-2 text-sm text-muted">{jobs.length ? t("jobs.empty.filtered") : t("jobs.empty.all")}</p>
          {(area || type) && (
            <button type="button" onClick={() => choose("", "")} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">
              {t("jobs.clear")}
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {visible.map((job) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`} className="flex h-full flex-col gap-1.5 rounded-[20px] border border-line p-4 text-ink transition-colors hover:bg-surface">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="break-words text-[17px] font-bold leading-snug">{job.title}</h2>
                  <StatusPill tone="neutral">{typeLabel(job.jobType)}</StatusPill>
                </div>
                <p className="text-[15px] font-semibold">{job.restaurant.name}</p>
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
                  {job.restaurant.area && <span>{job.restaurant.area}</span>}
                  {job.salary && <span>{t("jobs.pay", { salary: job.salary })}</span>}
                  <span>{posted(job.createdAt)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function JobsHeading() {
  const t = useT();
  return (
    <div className="pb-5 pt-5 md:pt-10">
      <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-[40px]">{t("jobs.title")}</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{t("jobs.intro")}</p>
    </div>
  );
}
