export type ReportTargetType = "merchant" | "story";
export type ReportStatus = "new" | "resolved" | "dismissed";

export interface ReportItem {
  id: string;
  targetType: ReportTargetType;
  merchantId: string | null;
  articleId: string | null;
  slug: string;
  name: string;
  targetGone: boolean;
  reason: string;
  note: string | null;
  contactEmail: string | null;
  status: ReportStatus;
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  sameTargetOpen: number;
}

type Invalid = { ok: false; status: number; code: string; message: string };

export declare const MAX_REPORT_BODY_BYTES: number;
export declare const REPORT_STATUSES: readonly ReportStatus[];
export declare const REPORT_REASONS: Readonly<Record<ReportTargetType, readonly { value: string; label: string }[]>>;
export declare function reasonLabel(targetType: ReportTargetType | string, reason: string): string;
export declare function parseReportSubmit(body: unknown):
  | { ok: true; targetType: ReportTargetType; slug: string; reason: string; note: string | null; contactEmail: string | null; honeypot: boolean }
  | Invalid;
export declare function parseReportDecision(body: unknown): { ok: true; id: string; status: ReportStatus; note: string | null } | Invalid;
export declare function mapReportRpcError(error: unknown): { status: number; code: string; message: string };
