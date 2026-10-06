import { NextResponse, type NextRequest } from 'next/server';

import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { MAX_REVIEW_BODY_BYTES, mapReviewRpcError, parseReviewDecision, parseCapacity } from '@/lib/merchant-review-core.mjs';
import { deliverSoon } from '@/app/api/_lib/notification-delivery';

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : errorResponse(401, 'AUTH_REQUIRED', 'Unauthorized');
}

export async function GET(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const { data, error } = await supabase.rpc('merchant_review_queue', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL });
  if (error) {
    console.error('merchant_review_queue failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the restaurant submissions.');
  }
  // The snapshot has no currency: add each restaurant's (RM or S$) so Admin sees prices as shown,
  // and the area's country so a currency/country mismatch is flagged (T6).
  const items = (data as { items?: { merchantId?: string }[] } | null)?.items ?? [];
  const ids = [...new Set(items.map((i) => i.merchantId).filter((id): id is string => typeof id === 'string'))];
  if (ids.length > 0) {
    const { data: rows } = await supabase.from('merchants').select('id, currency').in('id', ids);
    const currencyById = new Map((rows ?? []).map((r: { id: string; currency: string }) => [r.id, r.currency]));
    for (const item of items as { merchantId?: string; currency?: string }[]) item.currency = currencyById.get(item.merchantId ?? '') ?? 'MYR';
    const areaNames = [...new Set((items as { snapshot?: { area?: unknown } }[]).map((i) => i.snapshot?.area).filter((a): a is string => typeof a === 'string' && a.length > 0))];
    const { data: areaRows } = areaNames.length ? await supabase.from('areas').select('name, country').in('name', areaNames) : { data: [] };
    const countryByArea = new Map((areaRows ?? []).map((r: { name: string; country: string }) => [r.name, r.country]));
    for (const item of items as { snapshot?: { area?: unknown }; areaCountry?: string | null }[]) item.areaCountry = typeof item.snapshot?.area === 'string' ? countryByArea.get(item.snapshot.area) ?? null : null;
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_REVIEW_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseReviewDecision(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_review_decide', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_request_id: parsed.requestId,
    p_submission_id: parsed.submissionId, p_decision: parsed.decision, p_note: parsed.note,
  });
  if (error) {
    const mapped = mapReviewRpcError(error);
    if (mapped.status === 500) console.error('merchant_review_decide failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }
  deliverSoon();
  return NextResponse.json({ data, requestId: parsed.requestId });
}

export async function PUT(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try { body = await readBoundedJson(request, MAX_REVIEW_BODY_BYTES); }
  catch (error) { return errorResponse(error instanceof RequestBodyTooLargeError ? 413 : 400, 'VALIDATION_FAILED', 'Invalid request.'); }
  const parsed = parseCapacity(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_review_capacity_set', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_capacity: parsed.capacity, p_pilot_capacity: parsed.pilotCapacity ?? null, p_intake_mode: parsed.intakeMode ?? null });
  if (error) { const mapped = mapReviewRpcError(error); return errorResponse(mapped.status, mapped.code, mapped.message); }
  return NextResponse.json({ data });
}
