export type SubmissionAction = "view_story" | "edit_story" | "approve" | "create_draft" | "ai_draft" | "publish_original" | "publish_ai" | "request_changes" | "reject";
export interface LinkedStory { slug: string; published: boolean | null; editorial_status: string | null }
export declare const SUBMISSION_ACTIONS: readonly SubmissionAction[];
export declare function submissionActions(submission: { status: string; article?: LinkedStory | null; generated_copy?: unknown } | null | undefined): SubmissionAction[];
export declare function publicStoryPath(article: LinkedStory | null | undefined): string | null;
export declare function merchantSubmissionLabel(status: string, storyPath: string | null | undefined): string;
