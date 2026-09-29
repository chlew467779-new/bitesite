export type IssueKey = 'no_location' | 'no_cover' | 'no_menu' | 'no_contact' | 'no_story';

export declare const STORY_REMINDER_DAYS: number;
export declare const ISSUE_LABELS: Readonly<Record<IssueKey, string>>;
export declare function merchantIssues(
  merchant: { latitude?: number | null; longitude?: number | null; cover_image?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null; first_published_at?: string | null },
  facts: { productCount: number; lastStoryAt: string | null; isPublic: boolean; now?: Date },
): IssueKey[];
export declare function compareIssueRows<T extends { isPublic: boolean; issues: unknown[]; name: string }>(a: T, b: T): number;
