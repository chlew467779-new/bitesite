export type SiteFeedbackTopic = 'feature' | 'design' | 'problem' | 'other';
export type SiteFeedbackStatus = 'new' | 'done';
type Invalid = { ok: false; status: number; code: string; message: string };

export declare const SITE_FEEDBACK_TOPICS: readonly { readonly value: SiteFeedbackTopic; readonly label: string }[];
export declare const SITE_FEEDBACK_STATUSES: readonly SiteFeedbackStatus[];
export declare const SITE_FEEDBACK_MESSAGE_LIMIT: number;
export declare const MAX_SITE_FEEDBACK_BODY_BYTES: number;
export declare function isUrgentSiteTopic(topic: string): boolean;
export declare function isUrgentMerchantTopic(topic: string): boolean;
export declare function parseSiteFeedback(body: unknown):
  | { ok: true; honeypot: boolean; topic: SiteFeedbackTopic; message: string; contactEmail: string | null; page: string | null }
  | Invalid;
export declare function parseSiteFeedbackUpdate(body: unknown): { ok: true; ids: string[]; status: SiteFeedbackStatus } | Invalid;
export declare function daysWaiting(iso: string | null | undefined, now?: Date): number | null;
