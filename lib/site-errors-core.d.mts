export type SiteErrorStatus = 'new' | 'resolved';
export type SiteErrorSource = 'server' | 'browser';
type Invalid = { ok: false; status: number; code: string; message: string };

export declare const SITE_ERROR_STATUSES: readonly SiteErrorStatus[];
export declare const SITE_ERROR_MESSAGE_LIMIT: number;
export declare const MAX_BROWSER_ERROR_BODY_BYTES: number;
export declare function redactErrorText(text: unknown): string;
export declare function fingerprintText(source: SiteErrorSource, message: string): string;
export declare function pagePathOnly(path: unknown): string | null;
export declare function isIgnoredError(message: unknown, digest?: unknown): boolean;
export declare function messageFromConsoleArgs(args: unknown[]): string;
export declare function parseBrowserErrorReport(body: unknown): { ok: true; skip: boolean; message: string; page: string | null } | Invalid;
export declare function parseSiteErrorUpdate(body: unknown): { ok: true; ids: string[]; status: SiteErrorStatus } | Invalid;
