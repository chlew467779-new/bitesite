import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_NEARBY_RADIUS_KM, NEARBY_RADII_KM, distanceKm, formatDistanceKm, nearbyOtherRestaurants, nearbyRadius, selectNearby,
} from '../lib/nearby-core.mjs';

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

assert.equal(distanceKm(0, 0, 0, 0), 0);
assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.01);
assert.equal(distanceKm(0, 0, null, 1), null);
assert.equal(distanceKm(91, 0, 0, 0), null);

// G19: the visitor chooses 1, 3, 5 or 10 km (default 5); the range never widens by itself.
assert.deepEqual([...NEARBY_RADII_KM], [1, 3, 5, 10]);
assert.equal(DEFAULT_NEARBY_RADIUS_KM, 5);
assert.equal(nearbyRadius(3), 3);
assert.equal(nearbyRadius(25), 5, 'unknown range falls back to 5 km');
const merchant = (id, latitude, longitude) => ({ id, latitude, longitude });
// 0.01° of longitude at the equator ≈ 1.11 km.
const candidates = [merchant('k8', 0, 0.072), merchant('k4', 0, 0.036), merchant('k2', 0, 0.018), merchant('k05', 0, 0.0045), merchant('missing', null, null)];
const ids = (selection) => selection.results.map(({ merchant: item }) => item.id);
assert.deepEqual(ids(selectNearby(candidates, 0, 0)), ['k05', 'k2', 'k4'], 'default 5 km, nearest first');
assert.deepEqual(ids(selectNearby(candidates, 0, 0, 1)), ['k05']);
assert.deepEqual(ids(selectNearby(candidates, 0, 0, 3)), ['k05', 'k2']);
assert.deepEqual(ids(selectNearby(candidates, 0, 0, 10)), ['k05', 'k2', 'k4', 'k8']);
assert.equal(selectNearby(candidates, 0, 0, 10).radiusKm, 10);
assert.deepEqual(selectNearby([merchant('far', 0, 1)], 0, 0, 10).results, [], 'nothing in range: empty, not widened');
assert.deepEqual(selectNearby([merchant('none', null, null)], 0, 0).results, []);

// Store page: nearest other restaurants, at most 4, within 5 km, never the restaurant itself.
const origin = merchant('self', 0, 0);
const around = [origin, merchant('a', 0, 0.01), merchant('b', 0, 0.02), merchant('c', 0, 0.03), merchant('d', 0, 0.04), merchant('e', 0, 0.005), merchant('far', 0, 0.2), merchant('nocoords', null, null)];
assert.deepEqual(nearbyOtherRestaurants(origin, around).map(({ merchant: item }) => item.id), ['e', 'a', 'b', 'c'], 'self left out, 4 nearest, far one out');
assert.deepEqual(nearbyOtherRestaurants(merchant('x', null, null), around), [], 'no coordinates: nothing');
assert.deepEqual(nearbyOtherRestaurants(origin, [origin]), []);
assert.equal(formatDistanceKm(0.05), '<0.1 km');
assert.equal(formatDistanceKm(3.21), '3.2 km');

// Wiring: the homepage keeps Nearby with the other filters and never sends the visitor's position.
const home = await read('app/page.tsx');
assert.match(home, /selectNearby\(filtered, coordinates\.latitude, coordinates\.longitude, nearbyRadiusKm\)/);
assert.doesNotMatch(home, /if \(nearbyActive\) handleNearbyChange\(false\);/, 'choosing a state or area keeps Nearby on');
assert.doesNotMatch(home, /fetch\([^)]*(latitude|coords)/, 'coordinates are not sent anywhere');
const store = await read('app/store/[merchant]/page.tsx');
assert.match(store, /nearbyOtherRestaurants\(merchant, /, 'store page uses the restaurant\'s own coordinates');
const section = await read('components/sections/nearby-restaurants.tsx');
assert.doesNotMatch(section, /geolocation/, 'the store section never asks for the visitor\'s location');
console.log('nearby distance and radius checks passed');
