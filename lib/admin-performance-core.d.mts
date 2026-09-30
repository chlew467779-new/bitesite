export declare const PERFORMANCE_DAYS: readonly number[];
export declare const MIN_VIEWS_FOR_RATE: number;
export declare const LOW_CONTACT_RATE: number;
export declare function parseDays(value: unknown): 7 | 30 | 90;
export declare function compareKpi(current: number, previous: number | null | undefined): { delta: number; pct: number | null; direction: 'up' | 'down' | 'same' } | null;
export declare function contactRate(contacts: number, views: number): number | null;
export declare function isLowContact(row: { views: number; contacts: number }): boolean;
