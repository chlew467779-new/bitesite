/**
 * Opening-hours editing for the Merchant dashboard.
 *
 * The database keeps the existing shape: `operating_hours` is an object of day → string, e.g.
 * { monday: "09:00 - 18:00", tuesday: "Closed", friday: "11:00 - 14:00, 17:00 - 22:00" }. A day
 * that is missing is "not set" and public pages simply leave it out.
 *
 * The dashboard never lets a merchant type free text. Each day is either Closed or Open with one
 * to MAX_SLOTS_PER_DAY time ranges picked from time inputs, and is written back as
 * "HH:MM - HH:MM" (24-hour) or "Closed" — the same format the Admin editor writes.
 *
 * Values written earlier by Admin or by the old free-text field are left exactly as they are
 * unless the merchant changes that day: readable ones are shown in the editor, unreadable ones
 * ("legacy") are shown as a note and preserved. The API applies the same rule (see
 * isEditorHoursValue), so the format cannot be bypassed by calling it directly.
 *
 * Plain ESM so scripts/test-merchant-dashboard.mjs can execute it; types in merchant-hours.d.mts.
 */

export const WEEK_DAYS = Object.freeze(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
export const CLOSED_VALUE = "Closed";
export const MAX_SLOTS_PER_DAY = 3;

const TIME_24 = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ANY_TIME = /^(\d{1,2}):(\d{2})(?:\s*([AaPp])\.?\s*[Mm]\.?)?$/;
const EDITOR_SLOT = "(?:[01]\\d|2[0-3]):[0-5]\\d - (?:[01]\\d|2[0-3]):[0-5]\\d";
const EDITOR_VALUE = new RegExp(`^${EDITOR_SLOT}(?:, ${EDITOR_SLOT}){0,${MAX_SLOTS_PER_DAY - 1}}$`);

/** "9:00 AM", "9:00am", "09:00", "21:30" → "HH:MM" (24-hour) for a time input; anything else → null. */
export function toTimeInputValue(text) {
  if (typeof text !== "string") return null;
  const match = ANY_TIME.exec(text.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (minutes > 59) return null;
  if (period) {
    if (hours < 1 || hours > 12) return null;
    if (period === "P" && hours !== 12) hours += 12;
    if (period === "A" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function emptySlot() {
  return { open: "", close: "" };
}

/**
 * Turns one stored day value into editor state.
 * mode: "unset" (no value), "closed", "open" (readable ranges), or "legacy" (unreadable text,
 * kept verbatim until the merchant changes the day). `dirty` is false until the merchant edits.
 */
export function parseDayForEditor(raw) {
  const original = typeof raw === "string" && raw.trim() ? raw : null;
  if (!original) return { mode: "unset", slots: [emptySlot()], original: null, dirty: false };
  if (original.trim().toLowerCase() === "closed") {
    return { mode: "closed", slots: [emptySlot()], original, dirty: false };
  }
  const parts = original.split(/,|\/|&/).map((part) => part.trim()).filter(Boolean);
  const slots = [];
  for (const part of parts) {
    const range = part.split(/\s*[-–—]\s*|\s+to\s+/i);
    const open = range.length === 2 ? toTimeInputValue(range[0]) : null;
    const close = range.length === 2 ? toTimeInputValue(range[1]) : null;
    if (!open || !close) return { mode: "legacy", slots: [emptySlot()], original, dirty: false };
    slots.push({ open, close });
  }
  if (slots.length === 0 || slots.length > MAX_SLOTS_PER_DAY) {
    return { mode: "legacy", slots: [emptySlot()], original, dirty: false };
  }
  return { mode: "open", slots, original, dirty: false };
}

export function parseWeekForEditor(operatingHours) {
  const source = operatingHours && typeof operatingHours === "object" && !Array.isArray(operatingHours) ? operatingHours : {};
  return Object.fromEntries(WEEK_DAYS.map((day) => [day, parseDayForEditor(source[day])]));
}

/** Error message for a day the merchant is saving, or null when it is fine. */
export function validateDay(day) {
  if (!day || day.mode !== "open") return null;
  if (!Array.isArray(day.slots) || day.slots.length === 0) return "Add opening and closing times, or switch the day to Closed.";
  if (day.slots.length > MAX_SLOTS_PER_DAY) return `Use at most ${MAX_SLOTS_PER_DAY} time ranges.`;
  for (const slot of day.slots) {
    if (!slot.open || !slot.close) return "Choose both an opening and a closing time.";
    if (!TIME_24.test(slot.open) || !TIME_24.test(slot.close)) return "Choose times from the time picker.";
    if (slot.open === slot.close) return "Opening and closing times must be different.";
  }
  return null;
}

/** Stored string for a day, or null when the day should be left out. Unchanged days keep their original text. */
export function serializeDay(day) {
  if (!day) return null;
  if (!day.dirty) return day.original;
  if (day.mode === "closed") return CLOSED_VALUE;
  if (day.mode === "open") return day.slots.map((slot) => `${slot.open} - ${slot.close}`).join(", ");
  if (day.mode === "legacy") return day.original;
  return null;
}

/** Validates every changed day. Returns { [day]: message } (empty object when all is well). */
export function validateWeek(week) {
  const errors = {};
  for (const day of WEEK_DAYS) {
    const state = week?.[day];
    if (!state?.dirty) continue;
    const message = validateDay(state);
    if (message) errors[day] = message;
  }
  return errors;
}

export function hasWeekChanges(week) {
  return WEEK_DAYS.some((day) => Boolean(week?.[day]?.dirty));
}

/** operating_hours object for the API, in day order; days that are not set are left out. */
export function buildOperatingHours(week) {
  const hours = {};
  for (const day of WEEK_DAYS) {
    const value = serializeDay(week?.[day]);
    if (value) hours[day] = value;
  }
  return hours;
}

/** True for exactly what the dashboard writes: "Closed" or 1–3 "HH:MM - HH:MM" ranges. */
export function isEditorHoursValue(value) {
  return typeof value === "string" && (value === CLOSED_VALUE || EDITOR_VALUE.test(value));
}
