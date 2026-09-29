import assert from 'node:assert/strict';
import { findAreaConflict, parseCreateArea, parsePatchArea } from '../lib/admin-areas-core.mjs';

const id = '97f12f39-95c3-45e5-a299-1eddb903a992';
assert.deepEqual(parseCreateArea({ state: ' Kuala Lumpur ', name: ' Bangsar ', aliases: [' BSR '] }),
  { country: 'MY', state: 'Kuala Lumpur', name: 'Bangsar', aliases: ['BSR'] });
assert.deepEqual(parsePatchArea({ id, aliases: [' TTDI '], is_active: false }),
  { id, patch: { aliases: ['TTDI'], is_active: false } });
for (const bad of [
  { state: '', name: 'X' }, { state: 'X', name: ' ' },
  { state: 'X'.repeat(61), name: 'Y' }, { state: 'X', name: 'Y'.repeat(81) },
  { state: 'X', name: 'Y', aliases: [''] },
  { state: 'X', name: 'Y', aliases: ['A'.repeat(41)] },
  { state: 'X', name: 'Y', aliases: Array(11).fill('x') },
  { state: 'X', name: 'Y', aliases: ['a', 'A'] },
  { state: 'X', name: 'Y', aliases: ['y'] },
  { state: 'X', name: 'Y', country: 'SG' },
]) assert.throws(() => parseCreateArea(bad));
for (const bad of [
  { id, name: 'Renamed' }, { id, state: 'Selangor' }, { id, country: 'SG' },
  { id, delete: true }, { id, is_active: 'false' }, { id, aliases: 'A' },
  { id: 'wrong', is_active: false }, { id },
]) assert.throws(() => parsePatchArea(bad));
assert.equal(findAreaConflict({ name: 'New', aliases: [' bangsar '] }, [{ id, name: 'Bangsar' }]), null);
assert.equal(findAreaConflict({ name: 'New', aliases: ['BANGSAR'] }, [{ id, name: 'Bangsar' }]), 'Bangsar');
assert.equal(findAreaConflict({ name: 'Bangsar', aliases: [] }, [{ id, name: 'Bangsar' }], id), null);
console.log('admin area input checks passed');
