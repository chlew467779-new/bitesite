/* bitesite/lib/hours.ts */

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
