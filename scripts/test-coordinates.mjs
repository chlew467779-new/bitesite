import assert from 'node:assert/strict';
import { outsideMalaysiaSingaporeBounds, parseCoordinates } from '../lib/coordinates-core.mjs';

assert.deepEqual(parseCoordinates(' 3.0908, 101.6995 '), { latitude: 3.0908, longitude: 101.6995 });
assert.deepEqual(parseCoordinates('https://www.google.com/maps/place/Example/@3.0908,101.6995,17z/data=x'), { latitude: 3.0908, longitude: 101.6995 });
assert.deepEqual(parseCoordinates('0, 0'), { latitude: 0, longitude: 0 });
assert.equal(parseCoordinates('https://example.com/@3.0908,101.6995,17z'), null);
assert.equal(parseCoordinates('3.09, 101.69 extra'), null);
assert.equal(parseCoordinates('not coordinates'), null);
assert.equal(outsideMalaysiaSingaporeBounds(3.0908, 101.6995), false);
assert.equal(outsideMalaysiaSingaporeBounds(1.3, 103.8), false);
assert.equal(outsideMalaysiaSingaporeBounds(101.6995, 3.0908), true);
assert.equal(outsideMalaysiaSingaporeBounds(0.8, 99.5), false);
assert.equal(outsideMalaysiaSingaporeBounds(7.6, 119.5), true);
assert.equal(outsideMalaysiaSingaporeBounds(null, null), false);
console.log('coordinate helper checks passed');
