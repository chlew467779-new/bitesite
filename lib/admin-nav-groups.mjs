export const ADMIN_NAV_GROUPS = [
  { name: null, ids: ['today'] },
  { name: 'Restaurants', ids: ['merchant-manager', 'restaurant-reviews', 'link-reviews', 'content-service'] },
  { name: 'Stories', ids: ['stories-editor', 'story-submissions'] },
  { name: 'Inbox', ids: ['feedback', 'reports'] },
  { name: 'Performance', ids: ['overview', 'merchants', 'search', 'stories-analytics', 'trends', 'events'] },
  { name: 'Visitors', ids: ['devices', 'locations', 'referrers', 'map', 'hourly'] },
  { name: 'Site', ids: ['areas', 'popup'] },
];

export function groupBadgeCount(ids, attention) {
  return ids.reduce((total, id) => total + Math.max(0, Number(attention[id]) || 0), 0);
}
