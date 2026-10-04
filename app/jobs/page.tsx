import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/sections/footer";
import { getOpenJobs } from "@/lib/jobs-public";
import { JOB_TYPES, jobTypeLabel } from "@/lib/merchant-jobs-core.mjs";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Restaurant Jobs | BiteSite",
  description: "Find open restaurant jobs and contact the restaurant directly to apply.",
  alternates: { canonical: `${getSiteUrl()}/jobs` },
};

type PageProps = { searchParams: Promise<{ area?: string | string[]; type?: string | string[] }> };

function postedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently posted" : date.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default async function JobsPage({ searchParams }: PageProps) {
  const [jobs, params] = await Promise.all([getOpenJobs(200), searchParams]);
  const areas = [...new Set(jobs.map((job) => job.restaurant.area).filter((area): area is string => Boolean(area)))].sort((a, b) => a.localeCompare(b));
  const requestedArea = typeof params.area === "string" ? params.area : "";
  const requestedType = typeof params.type === "string" ? params.type : "";
  const area = areas.includes(requestedArea) ? requestedArea : "";
  const type = JOB_TYPES.some((item) => item.value === requestedType) ? requestedType : "";
  const visibleJobs = jobs.filter((job) => (!area || job.restaurant.area === area) && (!type || job.jobType === type));

  return (
    <main className="min-h-screen bg-[#FAFBF7] text-[#2C3E2D]">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold sm:text-4xl">Restaurant jobs</h1>
          <p className="mt-3 max-w-2xl text-[#6B6560]">Find an opening and contact the restaurant directly to apply. BiteSite does not collect applications.</p>
        </div>
        <form action="/jobs" method="get" className="mb-8 grid gap-3 rounded-xl border border-[#DDE5DC] bg-white p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <label className="block text-sm font-medium">Area
            <select name="area" defaultValue={area} className="mt-2 min-h-11 w-full rounded-lg border border-[#C9D6C7] bg-white px-3 text-base">
              <option value="">All areas</option>
              {areas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Job type
            <select name="type" defaultValue={type} className="mt-2 min-h-11 w-full rounded-lg border border-[#C9D6C7] bg-white px-3 text-base">
              <option value="">All types</option>
              {JOB_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-[#2C3E2D] px-5 text-sm font-medium text-white">Filter</button>
          <Link href="/jobs" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm text-[#2C3E2D] underline">Clear</Link>
        </form>
        <p className="mb-4 text-sm text-[#6B6560]" role="status">{visibleJobs.length} {visibleJobs.length === 1 ? "opening" : "openings"}</p>
        {visibleJobs.length === 0 ? (
          <div className="rounded-xl border border-[#DDE5DC] bg-white p-8 text-center">
            <h2 className="text-lg font-semibold">No jobs right now</h2>
            <p className="mt-2 text-[#6B6560]">{jobs.length ? "Try another area or job type." : "Please check back soon."}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {visibleJobs.map((job) => (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="block rounded-xl border border-[#DDE5DC] bg-white p-5 transition-colors hover:border-[#5A8F6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold break-words">{job.title}</h2>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">{jobTypeLabel(job.jobType)}</span>
                  </div>
                  <p className="mt-1 font-medium">{job.restaurant.name}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#6B6560]">
                    {job.restaurant.area && <span>{job.restaurant.area}</span>}
                    {job.salary && <span>Pay: {job.salary}</span>}
                    <span>Posted {postedDate(job.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </main>
  );
}
