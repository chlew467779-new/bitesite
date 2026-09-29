import assert from 'node:assert/strict';
import { distanceKm, selectNearby } from '../lib/nearby-core.mjs';

assert.equal(distanceKm(0, 0, 0, 0), 0);
assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.01);
assert.equal(distanceKm(0, 0, null, 1), null);
assert.equal(distanceKm(91, 0, 0, 0), null);
const merchant = (id, latitude, longitude) => ({ id, latitude, longitude });
const candidates = [merchant('far', 0, 0.3), merchant('mid', 0, 0.15), merchant('near', 0, 0.02), merchant('missing', null, null)];
const expanded = selectNearby(candidates, 0, 0);
assert.equal(expanded.radiusKm, 25);
assert.deepEqual(expanded.results.map(({ merchant: item }) => item.id), ['near', 'mid']);
const local = selectNearby([...candidates, merchant('near2', 0, 0.03), merchant('near3', 0, 0.04)], 0, 0);
assert.equal(local.radiusKm, 10);
assert.deepEqual(local.results.map(({ merchant: item }) => item.id), ['near', 'near2', 'near3']);
assert.deepEqual(selectNearby([merchant('none', null, null)], 0, 0).results, []);
console.log('nearby distance and radius checks passed');
