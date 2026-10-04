export interface ClaimedNotification {
  id: string;
  merchantId: string;
  audience: "owner" | "admin";
  kind: "review_submitted" | "review_withdrawn" | "review_approved" | "review_rejected" | "basics_approved" | "basics_rejected";
  message: string | null;
  attempts: number;
  createdAt: string;
  merchantName: string;
  slug: string;
  ownerUserId: string | null;
}
export type NotificationProvider =
  | { kind: "resend" | "log"; from: string }
  | { kind: "smtp"; from: string; host: string; port: number; user: string; pass: string };

export declare function notificationEmail(n: ClaimedNotification, siteUrl: string): { subject: string; text: string } | null;
export declare function siteErrorEmail(input: { source: string; message: string; page: string | null; reopened: boolean }, siteUrl: string): { subject: string; text: string };
export declare function notificationProvider(env: Record<string, string | undefined>): NotificationProvider | null;
