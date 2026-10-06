const EARTH_RADIUS_KM = 6371.0088;

/** The ranges a visitor can choose on the homepage (G19); 5 km is the starting choice. */
export const NEARBY_RADII_KM = Object.freeze([1, 3, 5, 10]);
export const DEFAULT_NEARBY_RADIUS_KM = 5;

/** Store page "Nearby restaurants": at most this many, within this distance of the restaurant. */
export const STORE_NEARBY_LIMIT = 4;
export const STORE_NEARBY_RADIUS_KM = 5;

function validCoordinates(latitude, longitude) {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

/** Great-circle distance in kilometres; null for missing or invalid coordinates. */
export function distanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  if (!validCoordinates(fromLatitude, fromLongitude) || !validCoordinates(toLatitude, toLongitude)) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLatitude)) * Math.cos(radians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** An allowed range in km; anything else falls back to the 5 km default. */
export function nearbyRadius(value) {
  return NEARBY_RADII_KM.includes(value) ? value : DEFAULT_NEARBY_RADIUS_KM;
}

/**
 * Homepage Nearby (G19): the merchants left after the other filters (cuisine, state, Open now…)
 * that are within the chosen range, nearest first, with their distance for the cards. The range
 * is the visitor's choice; it never widens by itself, so an empty result means "choose a larger
 * range". The visitor's coordinates stay in the browser: this runs client-side only.
 */
export function selectNearby(merchants, latitude, longitude, radiusKm = DEFAULT_NEARBY_RADIUS_KM) {
  const radius = nearbyRadius(radiusKm);
  const results = merchants.flatMap((merchant) => {
    const distance = distanceKm(latitude, longitude, merchant.latitude, merchant.longitude);
    return distance === null || distance > radius ? [] : [{ merchant, distanceKm: distance }];
  }).sort((a, b) => a.distanceKm - b.distanceKm);
  return { results, radiusKm: radius };
}

/**
 * Store page (G19): the nearest other public restaurants around `origin` (the restaurant itself),
 * at most STORE_NEARBY_LIMIT within STORE_NEARBY_RADIUS_KM. The caller passes only public rows; the
 * restaurant itself is left out by id. Empty when the restaurant has no coordinates.
 */
export function nearbyOtherRestaurants(origin, merchants, limit = STORE_NEARBY_LIMIT, radiusKm = STORE_NEARBY_RADIUS_KM) {
  if (!origin || !validCoordinates(origin.latitude, origin.longitude)) return [];
  return merchants
    .filter((merchant) => merchant.id !== origin.id)
    .flatMap((merchant) => {
      const distance = distanceKm(origin.latitude, origin.longitude, merchant.latitude, merchant.longitude);
      return distance === null || distance > radiusKm ? [] : [{ merchant, distanceKm: distance }];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** "0.4 km", "<0.1 km", "3.2 km": the distance as cards show it. */
export function formatDistanceKm(distance) {
  return `${distance < 0.1 ? '<0.1' : distance.toFixed(1)} km`;
}
