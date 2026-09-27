export type FeedbackTopic = "suggestion" | "problem" | "listing";
export type FeedbackStatus = "new" | "read" | "resolved";

export interface FeedbackItem {
  id: string;
  topic: FeedbackTopic;
  message: string;
  status: FeedbackStatus;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface FeedbackQueueItem extends FeedbackItem {
  merchantId: string;
  merchantName: string;
  slug: string;
}

type Invalid = { ok: false; status: number; code: string; message: string };

export declare const FEEDBACK_TOPICS: readonly { value: FeedbackTopic; label: string }[];
export declare const FEEDBACK_STATUSES: readonly FeedbackStatus[];
export declare const FEEDBACK_MESSAGE_LIMIT: number;
export declare const FEEDBACK_REPLY_LIMIT: number;
export declare const MAX_FEEDBACK_BODY_BYTES: number;
export declare function parseFeedbackSubmit(body: unknown): { ok: true; requestId: string; topic: FeedbackTopic; message: string } | Invalid;
export declare function parseFeedbackUpdate(body: unknown): { ok: true; id: string; status: FeedbackStatus; reply: string | null } | Invalid;
export declare function mapFeedbackRpcError(error: unknown): { status: number; code: string; message: string };
