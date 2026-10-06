import Link from "next/link";
import type { PublicJob } from "@/lib/jobs-public";
import { jobTypeLabel } from "@/lib/merchant-jobs-core.mjs";

/** "We're hiring" strip on the restaurant page; omitted when this restaurant has no open jobs. */
export function HiringSection({ jobs }: { jobs: PublicJob[] }) {
  if (jobs.length === 0) return null;
  const first = jobs[0];
  const more = jobs.length - 1;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4">
      <section
        aria-labelledby="hiring-heading"
        className="flex items-center justify-between gap-3 rounded-[22px] border border-[#F0D9B0] bg-[#FDF6E8] px-[18px] py-4 text-[#2A1A04]"
      >
        <div className="min-w-0">
          <h2 id="hiring-heading" className="text-base font-extrabold">We&apos;re hiring</h2>
          <p className="mt-0.5 break-words text-sm text-[#6B5326]">
            {first.title} · {jobTypeLabel(first.jobType)}
            {more > 0 ? ` · +${more} more` : ""}
          </p>
        </div>
        <Link
          href={jobs.length === 1 ? `/jobs/${first.id}` : "/jobs"}
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-[#E6C98F] bg-white px-4 text-sm font-bold text-[#6B4A0E] hover:bg-[#FFFBF2]"
        >
          {jobs.length === 1 ? "View job" : "View jobs"}
        </Link>
      </section>
    </div>
  );
}
