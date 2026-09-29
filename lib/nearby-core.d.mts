export function distanceKm(fromLatitude: number | null, fromLongitude: number | null, toLatitude: number | null, toLongitude: number | null): number | null;
export function selectNearby<T extends { latitude: number | null; longitude: number | null }>(merchants: T[], latitude: number, longitude: number): { results: { merchant: T; distanceKm: number }[]; radiusKm: 10 | 25 };
