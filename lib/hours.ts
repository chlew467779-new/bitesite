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
function parseTime(timeStr: string): number {
  const clean = timeStr.trim().toUpperCase();
  let [time, period] = clean.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  minutes = minutes || 0;

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Check if currently open based on hours string like "9:00 AM - 10:00 PM"
 * Forces Asia/Kuala_Lumpur timezone to prevent hydration mismatch.
 */
export function isCurrentlyOpen(hoursStr: string): boolean {
  if (!hoursStr || hoursStr.toLowerCase().includes("closed")) return false;

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

  // Handle formats: "9:00 AM - 10:00 PM" or "09:00 - 22:00"
  const parts2 = hoursStr.split("-").map((s) => s.trim());
  if (parts2.length !== 2) return true; // Can't parse, assume open

  try {
    const openMinutes = parseTime(parts2[0]);
    const closeMinutes = parseTime(parts2[1]);

    if (closeMinutes < openMinutes) {
      // Overnight (e.g., 6PM - 2AM)
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  } catch {
    return true; // Can't parse, assume open
  }
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
  if (lower === 'closed' || lower.includes('closed')) return 'Closed';

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

  if (validSlots.length === 0) return raw.trim(); // Can't parse, return original

  return validSlots.join(', ');
}
