import type { MonthSummary } from './monthly-summary-core.mjs';
export type NoticeKind =
  | 'review_approved' | 'review_rejected' | 'basics_approved' | 'basics_rejected'
  | 'link_approved' | 'link_rejected' | 'story_approved' | 'story_rejected' | 'story_changes' | 'story_published' | 'monthly_summary';
export declare const NOTICE_KINDS: readonly NoticeKind[];
export declare function waLink(number: string | null | undefined, text: string): string | null;
export declare function mailLink(email: string | null | undefined, subject: string, text: string): string | null;
export declare function noticeMessage(kind: NoticeKind, context: { name: string; note?: string | null; slug?: string | null; storySlug?: string | null; summary?: MonthSummary | null; site: string }): { subject: string; text: string };
