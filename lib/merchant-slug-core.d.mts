type Invalid = { ok: false; status: number; code: string; message: string };

export interface SlugRedirect { slug: string; since: string }
export interface SlugState { slug: string; public: boolean; everPublic: boolean; redirects: SlugRedirect[] }

export declare const MAX_SLUG_BODY_BYTES: number;
export declare const SLUG_RULE_TEXT: string;
export declare function normalizeSlug(value: unknown): string;
export declare function isValidSlug(value: unknown): boolean;
export declare function parseSlugChange(body: unknown): { ok: true; requestId: string; slug: string; expected: string } | Invalid;
export declare function mapSlugRpcError(error: unknown): { status: number; code: string; message: string };
