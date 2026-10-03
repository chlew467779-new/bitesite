export interface SummaryRange { from: string; to: string; label: string }
export interface SummaryRanges { thisMonth: SummaryRange; sameDaysLastMonth: SummaryRange; lastMonth: SummaryRange & { key: string }; monthBefore: SummaryRange }
export interface SummaryTotals { views: number; menuViews: number; contacts: number; whatsapp: number; calls: number; directions: number }
export interface DailyRow { view_date: string; event_type: string | null; page_type: string | null; count: number | null }
export interface MonthSummary { label: string; previousLabel: string; current: SummaryTotals; previous: SummaryTotals }
export declare const SUMMARY_TIME_ZONE: string;
export declare const CONTACT_EVENTS: readonly string[];
export declare const SUMMARY_EVENTS: readonly string[];
export declare function summaryRanges(now?: Date): SummaryRanges;
export declare function summaryTotals(rows: readonly DailyRow[] | null | undefined, range: { from: string; to: string }): SummaryTotals;
export declare function summaryChange(current: number, previous: number): { direction: "up" | "down" | "same" | "new" | "none"; percent: number | null };
export declare function changeWords(current: number, previous: number): string;
export declare function summaryMessage(input: { name: string; summary: MonthSummary; slug?: string | null; site: string }): { subject: string; text: string };
