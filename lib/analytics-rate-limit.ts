import "server-only";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const MAX_BUCKETS = 10_000;
const DEDUPE_WINDOW_MS = 10_000;

type Bucket = { startedAt: number; count: number };

// Best-effort per-instance protection. This intentionally has no external
// storage cost; a distributed limiter can replace it if traffic warrants one.
const buckets = new Map<string, Bucket>();
const recentEvents = new Map<string, number>();

function trimOldest<K, V>(map: Map<K, V>, limit: number) {
  while (map.size > limit) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function allowAnalyticsRequest(key: string, now = Date.now()): boolean {
  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.startedAt >= WINDOW_MS) buckets.delete(bucketKey);
    }
  }

  const current = buckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    trimOldest(buckets, MAX_BUCKETS);
    return true;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export function isDuplicateAnalyticsEvent(key: string, now = Date.now()): boolean {
  const previous = recentEvents.get(key);
  recentEvents.set(key, now);
  trimOldest(recentEvents, MAX_BUCKETS);

  if (recentEvents.size > MAX_BUCKETS) {
    for (const [eventKey, timestamp] of recentEvents) {
      if (now - timestamp >= DEDUPE_WINDOW_MS) recentEvents.delete(eventKey);
    }
  }

  return previous !== undefined && now - previous < DEDUPE_WINDOW_MS;
}
