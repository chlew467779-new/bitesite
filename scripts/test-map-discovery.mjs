import assert from 'node:assert/strict';
import { hasMapCoordinates, mapDiscoveryOptions } from '../lib/map-discovery-core.mjs';

const restaurant = (id, area, cuisine, latitude, longitude, cuisine_type = null) => ({ id, area, cuisine, cuisine_type, latitude, longitude });
const restaurants = [
  restaurant('a', 'Bangsar', ['Malaysian', 'Cafe'], 3.1, 101.7, 'Western'),
  restaurant('b', 'Bangsar', ['Cafe'], 3.2, 101.8),
  restaurant('c', 'TTDI', ['Japanese'], null, null),
  restaurant('d', 'Cheras', [], 3.3, 101.9, 'Chinese'),
];
const options = mapDiscoveryOptions(restaurants, [{ name: 'Bangsar' }, { name: 'TTDI' }, { name: 'Cheras' }]);
assert.deepEqual(options.mapped.map((restaurant) => restaurant.id), ['a', 'b', 'd']);
assert.equal(options.missingCount, 1);
assert.deepEqual(options.areas, ['Bangsar', 'Cheras']);
assert.ok(options.cuisines.includes('Malaysian'));
assert.ok(options.cuisines.includes('Cafe'));
assert.ok(options.cuisines.includes('Chinese'), 'legacy fallback is retained');
assert.ok(!options.cuisines.includes('Japanese'), 'unmapped restaurants do not create map filters');
assert.equal(hasMapCoordinates(restaurant('zero', null, [], 0, 0)), true);
assert.equal(hasMapCoordinates(restaurant('missing', null, [], null, 101)), false);
assert.equal(hasMapCoordinates(restaurant('reversed', null, [], 101, 3)), false);
console.log('map discovery checks passed');
