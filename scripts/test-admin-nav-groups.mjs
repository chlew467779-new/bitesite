import assert from 'node:assert/strict';
import { ADMIN_NAV_GROUPS, groupBadgeCount } from '../lib/admin-nav-groups.mjs';
const expected = ['today', 'overview', 'trends', 'merchants', 'devices', 'locations', 'areas', 'popup', 'referrers', 'search', 'events', 'stories-analytics', 'stories-editor', 'story-submissions', 'restaurant-reviews', 'link-reviews', 'feedback', 'reports', 'content-service', 'merchant-manager', 'map', 'hourly'];
const actual = ADMIN_NAV_GROUPS.flatMap((group) => group.ids);
assert.equal(new Set(actual).size, actual.length, 'each navigation id occurs once');
assert.deepEqual([...actual].sort(), [...expected].sort(), 'no missing or added navigation ids');
assert.equal(groupBadgeCount(['feedback', 'reports'], { feedback: 2, reports: 3 }), 5);
assert.equal(groupBadgeCount(['feedback', 'reports'], {}), 0);
console.log('admin navigation groups checks passed');
