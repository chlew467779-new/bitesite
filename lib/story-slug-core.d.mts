export declare const STORY_SLUG_MAX_LENGTH: number;
export declare const STORY_SLUG_RULE_TEXT: string;
export declare function isValidStorySlug(value: unknown): boolean;
export declare function storySlugBase(title: unknown, now?: Date): string;
export declare function makeStorySlug(title: unknown, existing: Iterable<string>, now?: Date): string;
export declare function decodeStorySlugParam(raw: unknown): string;
