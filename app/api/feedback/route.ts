/* bitesite/app/api/feedback/route.ts */

/**
 * Public "Feedback" about BiteSite itself: POST `{ topic, message, contactEmail?, page?, website? }`.
 * No sign-in. The sender is an HMAC of the client IP keyed by a server secret (never the raw IP);
 * the database caps feedback at 10 per sender per 24 hours. `website` is a honeypot: when filled
 * the request looks successful and nothing is stored.
 */

import { createHmac } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { allowAnalyticsRequest, getClientIp } from '@/lib/analytics-rate-limit';
import { MAX_SITE_FEEDBACK_BODY_BYTES, parseSiteFeedback } from '@/lib/site-feedback-core.mjs';

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function senderHash(ip: string): string | null {
  const secret = process.env.REPORT_HASH_SECRET || process.env.ADMIN_SESSION_SECRET;
  return secret ? createHmac('sha256', secret).update(`feedback:${ip}`).digest('hex') : null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!allowAnalyticsRequest(`feedback:${ip}`)) return errorResponse(429, 'RATE_LIMITED', 'Too many requests. Please try again in a minute.');
  const hash = senderHash(ip);
  if (!hash) {
    console.error('feedback: no REPORT_HASH_SECRET or ADMIN_SESSION_SECRET configured');
    return errorResponse(503, 'UNAVAILABLE', 'Feedback is not available right now.');
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_SITE_FEEDBACK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseSiteFeedback(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  if (parsed.honeypot) return NextResponse.json({ data: { status: 'applied' } });

  const { error } = await supabase.rpc('site_feedback_submit', {
    p_topic: parsed.topic,
    p_message: parsed.message,
    p_page_path: parsed.page,
    p_contact_email: parsed.contactEmail,
    p_reporter_hash: hash,
  });
  if (error) {
    if (error.code === 'P0001' && error.message === 'RATE_LIMITED') return errorResponse(429, 'RATE_LIMITED', 'You have sent a lot of feedback today. Thank you! Please try again tomorrow.');
    console.error('site_feedback_submit failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Your feedback could not be sent. Please try again.');
  }
  return NextResponse.json({ data: { status: 'applied' } });
}
