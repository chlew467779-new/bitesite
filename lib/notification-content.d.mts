export interface ClaimedNotification {
  id: string;
  merchantId: string;
  audience: "owner" | "admin";
  kind: "review_submitted" | "review_withdrawn" | "review_approved" | "review_rejected";
  message: string | null;
  attempts: number;
  createdAt: string;
  merchantName: string;
  slug: string;
  ownerUserId: string | null;
}
export type NotificationProvider = { kind: "resend" | "log"; from: string };

export declare function notificationEmail(n: ClaimedNotification, siteUrl: string): { subject: string; text: string } | null;
export declare function notificationProvider(env: Record<string, string | undefined>): NotificationProvider | null;
