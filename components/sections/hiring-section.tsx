import Link from "next/link";
import type { PublicJob } from "@/lib/jobs-public";
import { jobTypeLabel } from "@/lib/merchant-jobs-core.mjs";

/** Shared by all seven public restaurant layouts; omitted when this restaurant has no open jobs. */
export function HiringSection({ jobs }: { jobs: PublicJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <section aria-labelledby="hiring-heading" className="bg-[#FAFBF7] px-4 py-10 text-[#2C3E2D] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h2 id="hiring-heading" className="text-2xl font-semibold">We&apos;re hiring</h2>
        <p className="mt-2 text-sm text-[#6B6560]">Apply directly to the restaurant.</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {jobs.slice(0, 4).map((job) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`} className="flex min-h-16 flex-col justify-center rounded-xl border border-[#DDE5DC] bg-white p-4 hover:border-[#5A8F6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <span className="font-semibold break-words">{job.title}</span>
                <span className="mt-1 text-sm text-[#6B6560]">{jobTypeLabel(job.jobType)}{job.salary ? ` · ${job.salary}` : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-emerald-800 underline">Browse all jobs</Link>
      </div>
    </section>
  );
}
