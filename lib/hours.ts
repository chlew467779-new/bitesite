/**
 * Get current day key: "monday", "tuesday", etc.
 */
export function getTodayKey(): string {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    new Date().getDay()
  ];
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
 */
export function isCurrentlyOpen(hoursStr: string): boolean {
  if (!hoursStr || hoursStr.toLowerCase().includes("closed")) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Handle formats: "9:00 AM - 10:00 PM" or "09:00 - 22:00"
  const parts = hoursStr.split("-").map((s) => s.trim());
  if (parts.length !== 2) return true; // Can't parse, assume open

  try {
    const openMinutes = parseTime(parts[0]);
    const closeMinutes = parseTime(parts[1]);

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
