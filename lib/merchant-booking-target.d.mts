/* bitesite/lib/merchant-booking-target.d.mts */

/**
 * The restaurant's own WhatsApp number as wa.me digits, or null when it is not a usable
 * international number. Never falls back to a phone or platform number.
 */
export declare function normalizeBookingWhatsApp(value: string | null | undefined): string | null;

/**
 * wa.me URL for a booking message (one encoded `text` parameter), or null when the
 * WhatsApp destination is not valid.
 */
export declare function getBookingUrl(whatsapp: string | null | undefined, message?: string): string | null;
