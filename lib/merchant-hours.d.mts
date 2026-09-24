/* bitesite/lib/merchant-hours.d.mts */

/** Types for lib/merchant-hours.mjs. */

export type WeekDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface TimeRange {
  /** "HH:MM", 24-hour, as produced by <input type="time">. */
  open: string;
  close: string;
}

export interface DayEditorState {
  mode: "unset" | "closed" | "open" | "legacy";
  slots: TimeRange[];
  /** The stored value this day started from, or null when it was not set. */
  original: string | null;
  /** False until the merchant changes this day; unchanged days are saved exactly as they were. */
  dirty: boolean;
}

export type WeekEditorState = Record<WeekDay, DayEditorState>;

export declare const WEEK_DAYS: readonly WeekDay[];
export declare const CLOSED_VALUE: "Closed";
export declare const MAX_SLOTS_PER_DAY: number;

export declare function toTimeInputValue(text: unknown): string | null;
export declare function parseDayForEditor(raw: unknown): DayEditorState;
export declare function parseWeekForEditor(operatingHours: unknown): WeekEditorState;
export declare function validateDay(day: DayEditorState | null | undefined): string | null;
export declare function serializeDay(day: DayEditorState | null | undefined): string | null;
export declare function validateWeek(week: WeekEditorState): Partial<Record<WeekDay, string>>;
export declare function hasWeekChanges(week: WeekEditorState): boolean;
export declare function buildOperatingHours(week: WeekEditorState): Partial<Record<WeekDay, string>>;
export declare function isEditorHoursValue(value: unknown): boolean;
