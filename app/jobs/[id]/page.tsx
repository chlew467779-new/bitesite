import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/footer";
import { ReportProblem } from "@/app/components/report-problem";
import { getOpenJob } from "@/lib/jobs-public";
import { jobTypeLabel, jobWhatsappHref } from "@/lib/merchant-jobs-core.mjs";
import { phoneLinkDigits } from "@/lib/phone-core.mjs";
import { getSiteUrl } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/safe-json-ld.mjs";

export const revalidate = 60;
type PageProps = { params: Promise<{ id: string }> };

function asHtmlParagraph(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await getOpenJob(id);
  if (!job) return { title: "Job Not Found | BiteSite", robots: { index: false } };
  const description = `${job.title} at ${job.restaurant.name}${job.restaurant.area ? ` in ${job.restaurant.area}` : ""}. Apply directly to the restaurant.`;
  return {
    title: `${job.title} at ${job.restaurant.name} | BiteSite Jobs`,
    description,
    alternates: { canonical: `${getSiteUrl()}/jobs/${job.id}` },
    openGraph: { title: `${job.title} at ${job.restaurant.name}`, description, url: `${getSiteUrl()}/jobs/${job.id}` },
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getOpenJob(id);
  if (!job) notFound();

  const restaurantUrl = `/store/${encodeURIComponent(job.restaurant.slug)}`;
  const applyHref = jobWhatsappHref(job.restaurant.whatsapp, job.title, job.restaurant.name);
  const phone = job.restaurant.phone ? phoneLinkDigits(job.restaurant.phone) : "";
  const jobUrl = `${getSiteUrl()}/jobs/${job.id}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    identifier: { "@type": "PropertyValue", name: "BiteSite", value: job.id },
    title: job.title,
    description: `${asHtmlParagraph(job.description)}${asHtmlParagraph(`Hours: ${job.hours}`)}`,
    datePosted: job.createdAt,
    validThrough: job.expiresAt,
    employmentType: { full_time: "FULL_TIME", part_time: "PART_TIME", temporary: "TEMPORARY" }[job.jobType],
    hiringOrganization: { "@type": "Organization", name: job.restaurant.name, sameAs: `${getSiteUrl()}${restaurantUrl}` },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.restaurant.address ? { streetAddress: job.restaurant.address } : {}),
        ...(job.restaurant.area ? { addressLocality: job.restaurant.area } : {}),
        addressCountry: job.restaurant.currency === "SGD" ? "SG" : "MY",
      },
    },
    directApply: false,
    url: jobUrl,
  };

  return (
    <main className="min-h-screen bg-page text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }} />
      <article className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
        <Link href="/jobs" className="inline-flex min-h-11 items-center text-sm text-brand underline">← All jobs</Link>
        <div className="mt-5 rounded-[20px] border border-line bg-page p-5 sm:p-8">
          <p className="text-sm font-medium text-brand">{jobTypeLabel(job.jobType)}</p>
          <h1 className="mt-2 text-3xl font-semibold break-words sm:text-4xl">{job.title}</h1>
          <Link href={restaurantUrl} className="mt-3 inline-flex min-h-11 items-center font-medium text-brand underline">{job.restaurant.name}</Link>
          {job.restaurant.area && <p className="text-sm text-muted">{job.restaurant.area}</p>}

          <dl className="mt-7 grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Hours</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted">{job.hours}</dd></div>
            {job.salary && <div><dt className="font-medium">Pay</dt><dd className="mt-1 break-words text-muted">{job.salary}</dd></div>}
          </dl>

          <h2 className="mt-7 text-xl font-semibold">About the role</h2>
          <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-ink-2">{job.description}</p>

          <div className="mt-8 rounded-lg bg-brand-soft p-4">
            <p className="text-sm text-ink-2">Apply directly to the restaurant. BiteSite does not collect your application.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {applyHref && <a href={applyHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-medium text-white">Apply on WhatsApp</a>}
              {phone && <a href={`tel:+${phone}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand px-5 text-sm font-medium text-brand">Call restaurant</a>}
              {!applyHref && !phone && <Link href={restaurantUrl} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand px-5 text-sm font-medium text-brand">View restaurant</Link>}
            </div>
          </div>
        </div>
      </article>
      <ReportProblem targetType="job" slug={job.id} />
      <Footer />
    </main>
  );
}
