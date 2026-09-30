import assert from 'node:assert/strict';
import { createAreaRequests } from '../lib/area-requests.mjs';
import { parseFeedbackSubmit } from '../lib/merchant-feedback-core.mjs';

const requests = createAreaRequests();
const bodies = [];
let mode = 'network';
let ids = 0;
const options = {
  merchantId: 'restaurant-1', area: ' New Area ', address: ' 12 Test Street ',
  getHeaders: async () => ({ Authorization: 'Bearer test' }),
  requestId: () => { ids++; return '00000000-0000-4000-8000-000000000001'; },
  fetcher: async (url, init) => {
    assert.equal(url, '/api/merchant/restaurants/restaurant-1/feedback');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer test');
    bodies.push(JSON.parse(init.body));
    if (mode === 'network') throw new Error('offline');
    if (mode === 'server') return { status: 503, ok: false, json: async () => ({}) };
    if (mode === 'reject') return { status: 429, ok: false, json: async () => ({ error: { message: 'Slow down' } }) };
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  },
};
await assert.rejects(requests.submit(options), /offline/);
mode = 'server';
await assert.rejects(requests.submit({ ...options, address: 'changed during retry' }), /Not confirmed/);
mode = 'success';
await requests.submit(options);
assert.equal(ids, 1, 'unknown results retain the id');
assert.deepEqual(bodies[0], bodies[1], 'retry retains the original address and payload');
assert.deepEqual(bodies[0], bodies[2]);
assert.equal(bodies[0].message, 'Please add this area: New Area\nAddress: 12 Test Street');
assert.equal(parseFeedbackSubmit(bodies[0]).ok, true, 'existing feedback API accepts the payload');
assert.equal(requests.isSent('restaurant-1', 'new area'), true);
await requests.submit({ ...options, area: 'NEW AREA' });
assert.equal(bodies.length, 3, 'same area cannot send twice during this page session');
assert.equal(requests.isSent('restaurant-2', 'new area'), false, 'merchant scope stays separate');

mode = 'reject';
await assert.rejects(requests.submit({ ...options, area: 'Another' }), /Slow down/);
mode = 'success';
await requests.submit({ ...options, area: 'Another', address: '' });
assert.equal(ids, 3, 'known rejection permits a fresh attempt');
assert.equal(bodies.at(-1).message, 'Please add this area: Another');
const before = bodies.length;
await assert.rejects(requests.submit({ ...options, area: 'No session', getHeaders: async () => null }), /session has ended/);
assert.equal(bodies.length, before, 'missing authentication sends nothing');

const concurrent = createAreaRequests();
await Promise.all([concurrent.submit(options), concurrent.submit(options)]);
assert.equal(bodies.length, before + 1, 'concurrent duplicate clicks send once');
console.log('area request retry and deduplication checks passed');
