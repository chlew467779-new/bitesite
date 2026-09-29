const EARTH_RADIUS_KM = 6371.0088;

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

/** Select nearby merchants after other homepage filters, preserving distance for the cards. */
export function selectNearby(merchants, latitude, longitude) {
  const ranked = merchants.flatMap((merchant) => {
    const distance = distanceKm(latitude, longitude, merchant.latitude, merchant.longitude);
    return distance === null ? [] : [{ merchant, distanceKm: distance }];
  }).sort((a, b) => a.distanceKm - b.distanceKm);
  const withinTen = ranked.filter((item) => item.distanceKm <= 10);
  const radiusKm = withinTen.length < 3 ? 25 : 10;
  return { results: radiusKm === 10 ? withinTen : ranked.filter((item) => item.distanceKm <= 25), radiusKm };
}
