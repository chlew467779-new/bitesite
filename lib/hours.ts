/* bitesite/lib/hours.ts */

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Get current day key: "monday", "tuesday", etc.
 * Forces Asia/Kuala_Lumpur timezone to prevent hydration mismatch
 * between server (UTC) and client (UTC+8).
 */
export function getTodayKey(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long",
  });
  return formatter.format(new Date()).toLowerCase();
}

/**
 * Parse time string like "9:00 AM" or "14:00" to minutes from midnight
 */
function parseTime(timeStr: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i.exec(timeStr.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (minutes > 59) return null;
  if (period && (hours < 1 || hours > 12)) return null;
  if (!period && hours > 23) return null;

  const normalizedHours = period === "PM" && hours !== 12
    ? hours + 12
    : period === "AM" && hours === 12
      ? 0
      : hours;
  return normalizedHours * 60 + minutes;
}

function parseTimeRange(value: string): { open: number; close: number } | null {
  const parts = value.split("-").map((part) => part.trim());
  if (parts.length !== 2) return null;
  const open = parseTime(parts[0]);
  const close = parseTime(parts[1]);
  return open === null || close === null ? null : { open, close };
}

/**
 * Accept the formats supported by the Admin editor: 24-hour HH:MM or
 * 12-hour H:MM AM/PM ranges, with optional comma, slash, or ampersand slots.
 */
export function isValidOperatingHours(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  if (raw.trim().toLowerCase() === "closed") return true;
  const slots = raw.split(/,|\/|&/).map((slot) => slot.trim()).filter(Boolean);
  return slots.length > 0 && slots.every((slot) => parseTimeRange(slot) !== null);
}

/**
 * Check if currently open based on hours string like "9:00 AM - 10:00 PM"
 * Forces Asia/Kuala_Lumpur timezone to prevent hydration mismatch.
 */
export function isCurrentlyOpen(hoursStr: string): boolean {
  if (!hoursStr || hoursStr.trim().toLowerCase() === "closed" || !isValidOperatingHours(hoursStr)) return false;

  // Force KL timezone for consistent server/client behavior
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === "hour")?.value;
  const minutePart = parts.find((p) => p.type === "minute")?.value;
  const currentMinutes = parseInt(hourPart || "0") * 60 + parseInt(minutePart || "0");

  return hoursStr
    .split(/,|\/|&/)
    .map((slot) => parseTimeRange(slot.trim()))
    .some((range) => {
      if (!range) return false;
      if (range.close < range.open) {
        // Overnight (e.g., 6 PM - 2 AM)
        return currentMinutes >= range.open || currentMinutes <= range.close;
      }
      return currentMinutes >= range.open && currentMinutes <= range.close;
    });
}

/**
 * Format hours for display
 */
export function getTodayHours(operatingHours: Record<string, string> | null): {
  isOpen: boolean;
  hoursText: string;
  todayKey: string;
} {
  const todayKey = getTodayKey();
  const todayHours = operatingHours?.[todayKey];

  if (!todayHours) {
    return { isOpen: false, hoursText: "Hours unavailable", todayKey };
  }

  if (!isValidOperatingHours(todayHours)) {
    return { isOpen: false, hoursText: "Hours unavailable", todayKey };
  }

  const isOpen = isCurrentlyOpen(todayHours);
  return { isOpen, hoursText: todayHours, todayKey };
}

/* ── Structured hours helpers (Admin + Frontend) ── */

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DayHours {
  slots: TimeSlot[];
  isClosed: boolean;
}

/**
 * Parse a raw hours string into structured slots for Admin editing
 */
export function parseOperatingHoursString(raw: string | null | undefined): DayHours {
  if (!raw || !raw.trim()) {
    return { slots: [{ start: '', end: '' }], isClosed: false };
  }

  const lower = raw.trim().toLowerCase();
  if (lower === 'closed' || lower.includes('closed')) {
    return { slots: [], isClosed: true };
  }

  const slotStrs = raw.split(/,|\/|&/).map((s) => s.trim()).filter(Boolean);
  const slots: TimeSlot[] = [];

  for (const slotStr of slotStrs) {
    const parts = slotStr.split('-').map((s) => s.trim());
    if (parts.length === 2) {
      slots.push({ start: parts[0], end: parts[1] });
    }
  }

  if (slots.length === 0) {
    return { slots: [{ start: '', end: '' }], isClosed: false };
  }

  return { slots, isClosed: false };
}

/**
 * Format structured slots back to a string for database storage
 */
export function formatOperatingHoursToString(dayHours: DayHours): string {
  if (dayHours.isClosed) return 'Closed';
  const validSlots = dayHours.slots.filter((s) => s.start.trim() && s.end.trim());
  if (validSlots.length === 0) return '';
  return validSlots.map((s) => `${s.start.trim()} - ${s.end.trim()}`).join(', ');
}

/**
 * Normalize hours string for frontend display
 * - Standardizes AM/PM casing
 * - Deduplicates repeated slots
 * - Recognizes "Closed" (case-insensitive)
 * - Filters out slots that don't look like valid time ranges
 */
export function formatOperatingHours(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return '';
  const lower = raw.trim().toLowerCase();
  if (lower === 'closed') return 'Closed';

  if (!isValidOperatingHours(raw)) return 'Hours unavailable';

  // Normalize AM/PM variations
  let formatted = raw
    .replace(/\s*a\.m\.?/gi, ' AM')
    .replace(/\s*p\.m\.?/gi, ' PM')
    .replace(/\s*am(?!\w)/gi, ' AM')
    .replace(/\s*pm(?!\w)/gi, ' PM');

  // Normalize whitespace
  formatted = formatted.replace(/\s+/g, ' ').trim();

  // Split into slots
  const slots = formatted.split(/,|\/|&/).map((s) => s.trim()).filter(Boolean);
  const uniqueSlots = [...new Set(slots)];

  // Validate each slot looks like a time range: "9:00 AM - 10:00 PM"
  const timeLike = /^\d{1,2}(:\d{2})?(\s*[AP]M)?$/i;
  const validSlots = uniqueSlots.filter((slot) => {
    if (!slot.includes('-')) return false;
    const parts = slot.split('-').map((s) => s.trim());
    if (parts.length !== 2) return false;
    return timeLike.test(parts[0]) && timeLike.test(parts[1]);
  });

  if (validSlots.length === 0) return 'Hours unavailable';

  return validSlots.join(', ');
}
