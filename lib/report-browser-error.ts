/* bitesite/lib/report-browser-error.ts */

/**
 * Error pages tell the server a visitor saw "Something went wrong" (SYNC-070). Best effort: one
 * report per error, the page path only (no query), and failures are ignored. Crashes with a digest
 * were recorded on the server already, and the endpoint skips them.
 */

const sent = new WeakSet<object>();

export function reportBrowserError(error: Error & { digest?: string }) {
  if (typeof window === 'undefined' || sent.has(error)) return;
  sent.add(error);
  const message = `${error.name && error.name !== 'Error' ? `${error.name}: ` : ''}${error.message || 'Unknown error'}`.slice(0, 2000);
  try {
    void fetch('/api/site-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, page: window.location.pathname, digest: error.digest ?? null }),
      keepalive: true,
    }).catch(() => undefined);
  } catch { /* reporting must never break the error page */ }
}
