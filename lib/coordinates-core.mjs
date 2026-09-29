const NUMBER = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const PLAIN_PAIR = new RegExp(`^\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*$`);
const MAPS_PAIR = new RegExp(`@(${NUMBER}),(${NUMBER})(?:,|/|$)`);

/** A coordinate pair or an unshortened Google Maps URL containing @latitude,longitude. */
export function parseCoordinates(text) {
  if (typeof text !== 'string') return null;
  let match = PLAIN_PAIR.exec(text);
  if (!match) {
    try {
      const url = new URL(text.trim());
      if (url.protocol !== 'https:' || !(url.hostname === 'google.com' || url.hostname.endsWith('.google.com'))) return null;
      match = MAPS_PAIR.exec(decodeURIComponent(url.pathname));
    } catch { return null; }
  }
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/** Advisory pilot bounds only; saving remains subject to the existing server rules. */
export function outsideMalaysiaSingaporeBounds(latitude, longitude) {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)) return false;
  return latitude < 0.8 || latitude > 7.5 || longitude < 99.5 || longitude > 119.5;
}
