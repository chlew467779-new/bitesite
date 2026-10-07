import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetail } from "@/components/jobs/job-detail";
import { Footer } from "@/components/sections/footer";
import { ReportProblem } from "@/app/components/report-problem";
import { getOpenJob } from "@/lib/jobs-public";
import { jobWhatsappHref } from "@/lib/merchant-jobs-core.mjs";
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
  const phone = job.restaurant.phone ? (phoneLinkDigits(job.restaurant.phone) ?? "") : "";
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
      <JobDetail job={job} restaurantUrl={restaurantUrl} applyHref={applyHref} phone={phone} />
      <ReportProblem targetType="job" slug={job.id} />
      <Footer />
    </main>
  );
}
