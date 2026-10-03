/* bitesite/app/api/site-errors/route.ts */

/**
 * Browser crash report from the error pages (SYNC-070): POST `{ message, page, digest? }`.
 * No sign-in, nothing identifying is stored (no IP). Crashes that came from the server (with a
 * digest) were recorded there already and are skipped. Only same-site requests are accepted;
 * per-IP request limit here, hourly cap on new kinds of error in the database.
 * Always answers 204 for a valid request, so the page never shows a second error.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { allowAnalyticsRequest, getClientIp } from '@/lib/analytics-rate-limit';
import { MAX_BROWSER_ERROR_BODY_BYTES, parseBrowserErrorReport } from '@/lib/site-errors-core.mjs';
import { recordSiteError } from '@/app/api/_lib/site-errors';

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return errorResponse(403, 'FORBIDDEN', 'Not allowed.');
  if (!allowAnalyticsRequest(`site-errors:${getClientIp(request)}`)) return errorResponse(429, 'RATE_LIMITED', 'Too many requests.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_BROWSER_ERROR_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseBrowserErrorReport(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  if (!parsed.skip) await recordSiteError('browser', parsed.message, parsed.page);
  return new NextResponse(null, { status: 204 });
}
