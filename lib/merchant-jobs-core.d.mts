export type JobType = "full_time" | "part_time" | "temporary";
export type JobAction = "close" | "renew" | "delete";
export type JobReportReason = "scam" | "misleading" | "discriminatory" | "filled" | "other";

/** One post as the Owner/Admin functions return it (private.merchant_job_json). */
export interface JobItem {
  id: string;
  title: string;
  jobType: JobType;
  salary: string | null;
  hours: string;
  description: string;
  status: "open" | "closed";
  expiresAt: string;
  expired: boolean;
  hidden: boolean;
  hiddenNote: string | null;
  live: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface JobsRead { canPost: boolean; openLimit: number; jobs: JobItem[] }
export interface AdminJobItem extends JobItem {
  merchantId: string;
  merchantName: string;
  slug: string;
  merchantPublic: boolean;
  openReports: number;
}

type Invalid = { ok: false; status: number; code: string; message: string };

export declare const JOB_TYPES: readonly { value: JobType; label: string }[];
export declare const JOB_LIMITS: Readonly<{ title: number; salary: number; hours: number; description: number; openPosts: number; days: number }>;
export declare const MAX_JOB_BODY_BYTES: number;
export declare const JOB_ACTIONS: readonly JobAction[];
export declare const JOB_REPORT_REASONS: readonly { value: JobReportReason; label: string }[];
export declare function isJobId(value: unknown): value is string;
export declare function jobTypeLabel(value: string): string;
export declare function jobFormProblems(job: unknown): Partial<Record<"title" | "jobType" | "salary" | "hours" | "description", string>>;
export declare function parseJobRequest(body: unknown):
  | { ok: true; action: "save"; jobId: string; title: string; jobType: JobType; salary: string | null; hours: string; description: string }
  | { ok: true; action: JobAction; jobId: string }
  | Invalid;
export declare function parseJobHide(body: unknown): { ok: true; jobId: string; hide: boolean; note: string | null } | Invalid;
export declare function isJobFeatureMissing(error: unknown): boolean;
export declare function mapJobRpcError(error: unknown): { status: number; code: string; message: string };
export declare function jobWhatsappHref(whatsapp: string | null | undefined, jobTitle: string, restaurantName: string): string | null;
export declare function jobDaysLeft(expiresAt: string, now?: number): number;
