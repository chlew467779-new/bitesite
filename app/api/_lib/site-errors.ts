/* bitesite/app/api/_lib/site-errors.ts */

/**
 * Records site errors (SYNC-070) in public.site_errors through site_error_record, so Admin shows
 * them without any outside service:
 *
 *  - every server console.error (the API routes log there when they answer 500), via
 *    installConsoleHook() from instrumentation.ts;
 *  - uncaught server errors (pages, routes, actions), via onRequestError in instrumentation.ts;
 *  - browser crashes on the error pages, via /api/site-errors.
 *
 * Best effort: it never throws, never logs through the hook again, sends one kind of error at most
 * once per 10 seconds and at most 30 per minute per server instance. Only production records
 * (or SITE_ERRORS_IN_DEV=1 for a local check); before the migration runs nothing is recorded.
 *
 * Lives under app/api/ because it uses the service-role client (scripts/check-service-role-usage.mjs).
 */

import 'server-only';
import { after } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { fingerprintText, isIgnoredError, messageFromConsoleArgs, pagePathOnly, redactErrorText, type SiteErrorSource } from '@/lib/site-errors-core.mjs';

const REPEAT_MS = 10_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const OFF_AFTER_MISSING_MS = 10 * 60_000;
const CONSOLE_DELAY_MS = 300;

type State = { original: typeof console.error; recent: Map<string, number>; windowStart: number; inWindow: number; offUntil: number; depth: number; hooked: boolean };
const store = globalThis as typeof globalThis & { __bitesiteSiteErrors?: State };
const state: State = store.__bitesiteSiteErrors ??= {
  original: console.error.bind(console), recent: new Map(), windowStart: 0, inWindow: 0, offUntil: 0, depth: 0, hooked: false,
};

// Web Crypto, not node:crypto: instrumentation is also compiled for the Edge runtime in webpack dev.
async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function enabled(now: number) {
  if (process.env.NEXT_PHASE === 'phase-production-build') return false;
  if (process.env.NODE_ENV !== 'production' && process.env.SITE_ERRORS_IN_DEV !== '1') return false;
  return now >= state.offUntil;
}

/** Keep the instance alive until the write finishes (Next's after(), else Vercel's waitUntil). */
function keepAlive(work: Promise<void>) {
  try { after(() => work); return; } catch { /* outside a request */ }
  const context = (globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined>)[Symbol.for('@vercel/request-context')];
  try { context?.get?.()?.waitUntil?.(work); } catch { /* the promise still runs */ }
}

export async function recordSiteError(source: SiteErrorSource, rawMessage: string, page: string | null): Promise<void> {
  const now = Date.now();
  if (!enabled(now)) return;
  const message = redactErrorText(rawMessage);
  if (!message) return;
  const fingerprint = await sha256Hex(fingerprintText(source, message));
  if (now - (state.recent.get(fingerprint) ?? 0) < REPEAT_MS) return;
  if (now - state.windowStart >= WINDOW_MS) { state.windowStart = now; state.inWindow = 0; }
  if (state.inWindow >= MAX_PER_WINDOW) return;
  state.inWindow += 1;
  state.recent.set(fingerprint, now);
  if (state.recent.size > 500) state.recent.delete(state.recent.keys().next().value!);
  try {
    const { error } = await supabase.rpc('site_error_record', { p_source: source, p_message: message, p_page_path: pagePathOnly(page), p_fingerprint: fingerprint });
    if (error) {
      // Before the migration (function missing) stay quiet for a while instead of failing every time.
      if (error.code === 'PGRST202' || error.code === '42883') state.offUntil = now + OFF_AFTER_MISSING_MS;
      else state.original('site error not recorded:', error.message);
    }
  } catch (caught) {
    state.offUntil = now + OFF_AFTER_MISSING_MS;
    state.original('site error not recorded:', caught instanceof Error ? caught.message : String(caught));
  }
}

/** Uncaught server error from onRequestError (instrumentation.ts). */
export async function recordRequestError(error: unknown, path: string): Promise<void> {
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? (error as { digest?: unknown }).digest : undefined;
  const message = messageFromConsoleArgs([error]);
  if (!message || isIgnoredError(message, digest)) return;
  await recordSiteError('server', message, path);
}

/** Record every server console.error as well as printing it. Installed once per instance. */
export function installConsoleHook() {
  if (state.hooked) return;
  state.hooked = true;
  console.error = (...args: unknown[]) => {
    state.original(...args);
    if (state.depth > 0) return;
    state.depth += 1;
    try {
      const message = messageFromConsoleArgs(args);
      // Next logs an uncaught error just before onRequestError reports it with its page: wait a
      // moment so that report (with the page) is the one kept and this copy is dropped as a repeat.
      if (message) keepAlive(new Promise<void>((done) => { setTimeout(done, CONSOLE_DELAY_MS); }).then(() => recordSiteError('server', message, null)));
    } catch { /* never let reporting break the caller */ } finally {
      state.depth -= 1;
    }
  };
}
