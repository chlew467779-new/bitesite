import type { Metadata } from "next";
import { Footer } from "@/components/sections/footer";
import { getOpenJobs } from "@/lib/jobs-public";
import { JOB_TYPES } from "@/lib/merchant-jobs-core.mjs";
import { JobsHeading, JobsList } from "@/components/jobs/jobs-list";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Restaurant Jobs | BiteSite",
  description: "Find open restaurant jobs and contact the restaurant directly to apply.",
  alternates: { canonical: `${getSiteUrl()}/jobs` },
};

type PageProps = { searchParams: Promise<{ area?: string | string[]; type?: string | string[] }> };

export default async function JobsPage({ searchParams }: PageProps) {
  const [jobs, params] = await Promise.all([getOpenJobs(200), searchParams]);
  const areas = new Set(jobs.map((job) => job.restaurant.area).filter(Boolean));
  const requestedArea = typeof params.area === "string" ? params.area : "";
  const requestedType = typeof params.type === "string" ? params.type : "";
  const area = areas.has(requestedArea) ? requestedArea : "";
  const type = JOB_TYPES.some((item) => item.value === requestedType) ? requestedType : "";

  return (
    <main className="min-h-screen bg-page text-ink">
      <div className="mx-auto max-w-5xl px-4 pb-10">
        <JobsHeading />
        <JobsList jobs={jobs} initialArea={area} initialType={type} />
      </div>
      <Footer />
    </main>
  );
}
