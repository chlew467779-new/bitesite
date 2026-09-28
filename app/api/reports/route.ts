/* bitesite/app/api/reports/route.ts */

/**
 * Public "Report a problem" for restaurant and Story pages: POST `{ targetType, slug, reason,
 * note?, contactEmail?, website? }`. No sign-in. The reporter is an HMAC of the client IP keyed by
 * a server secret (never the raw IP); the database drops duplicates and caps reports per reporter.
 * The honeypot `website` field is accepted and silently dropped when filled. Reports only reach the
 * Admin inbox; nothing on the page changes.
 */

import { createHmac } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { allowAnalyticsRequest, getClientIp } from '@/lib/analytics-rate-limit';
import { MAX_REPORT_BODY_BYTES, mapReportRpcError, parseReportSubmit } from '@/lib/public-report-core.mjs';

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function reporterHash(ip: string): string | null {
  const secret = process.env.REPORT_HASH_SECRET || process.env.ADMIN_SESSION_SECRET;
  return secret ? createHmac('sha256', secret).update(`report:${ip}`).digest('hex') : null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!allowAnalyticsRequest(`report:${ip}`)) return errorResponse(429, 'RATE_LIMITED', 'Too many requests. Please try again in a minute.');
  const hash = reporterHash(ip);
  if (!hash) {
    console.error('reports: no REPORT_HASH_SECRET or ADMIN_SESSION_SECRET configured');
    return errorResponse(503, 'UNAVAILABLE', 'Reporting is not available right now.');
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_REPORT_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseReportSubmit(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  if (parsed.honeypot) return NextResponse.json({ data: { status: 'applied' } });

  const { error } = await supabase.rpc('public_report_submit', {
    p_target_type: parsed.targetType,
    p_slug: parsed.slug,
    p_reason: parsed.reason,
    p_note: parsed.note,
    p_contact_email: parsed.contactEmail,
    p_reporter_hash: hash,
  });
  if (error) {
    const mapped = mapReportRpcError(error);
    if (mapped.status === 500) console.error('public_report_submit failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  // A duplicate looks the same to the reporter: it is already with the team.
  return NextResponse.json({ data: { status: 'applied' } });
}
