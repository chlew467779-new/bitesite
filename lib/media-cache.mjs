/**
 * Cache time for uploaded photos. Every upload gets a new, never-reused file name (a UUID), so a
 * file never changes after upload and browsers and the storage CDN may keep it for a year.
 */
export const IMMUTABLE_CACHE_SECONDS = "31536000";
