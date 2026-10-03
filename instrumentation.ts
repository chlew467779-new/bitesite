/* bitesite/instrumentation.ts */

/**
 * Site errors (SYNC-070): server errors are recorded for Admin's "Site Errors" page.
 * register() makes every server console.error also record; onRequestError records uncaught
 * errors with their page. Node.js runtime only; the recorder is loaded lazily.
 */

import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { installConsoleHook } = await import('./app/api/_lib/site-errors');
  installConsoleHook();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { recordRequestError } = await import('./app/api/_lib/site-errors');
    await recordRequestError(error, request.path);
  } catch { /* reporting must never add a second failure */ }
};
