/* bitesite/app/api/admin/jobs/route.ts */

/**
 * Admin job posts (#23): GET `?filter=visible|hidden|all` (newest 300, with open report counts), or
 * GET `?merchantId=` for one restaurant's posts (same shape as the Owner read, for its editor tab);
 * PATCH `{ jobId, hide, note? }` hides a post (note required, the Owner sees it) or shows it again;
 * POST `{ merchantId, action, jobId, ... }` posts, edits, closes, renews or deletes for a restaurant
 * (same body as the Owner route plus merchantId). 503 FEATURE_OFF until the release SQL runs.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL, isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_JOB_BODY_BYTES, mapJobRpcError, parseJobHide, parseJobRequest } from '@/lib/merchant-jobs-core.mjs';

const FILTERS = ['visible', 'hidden', 'all'];

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : errorResponse(401, 'AUTH_REQUIRED', 'Unauthorized');
}

function rpcFailure(error: { message: string }, label: string) {
  const mapped = mapJobRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message);
}

async function readBody(request: NextRequest): Promise<{ body: unknown } | { response: NextResponse }> {
  try {
    return { body: await readBoundedJson(request, MAX_JOB_BODY_BYTES) };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return { response: errorResponse(413, 'BODY_TOO_LARGE', error.message) };
    if (error instanceof InvalidJsonBodyError) return { response: errorResponse(400, 'INVALID_JSON', error.message) };
    return { response: errorResponse(400, 'INVALID_JSON', 'Invalid request.') };
  }
}

export async function GET(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const merchantId = request.nextUrl.searchParams.get('merchantId');
  if (merchantId !== null) {
    if (!isMerchantId(merchantId)) return errorResponse(400, 'VALIDATION_FAILED', 'A valid merchantId is required.');
    const { data, error } = await supabase.rpc('merchant_jobs_read', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId });
    if (error) return rpcFailure(error, 'merchant_jobs_read');
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const filter = request.nextUrl.searchParams.get('filter') ?? 'visible';
  if (!FILTERS.includes(filter)) return errorResponse(400, 'VALIDATION_FAILED', 'Unknown filter.');
  const { data, error } = await supabase.rpc('merchant_job_admin_list', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_filter: filter });
  if (error) return rpcFailure(error, 'merchant_job_admin_list');
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const parsed = parseJobHide(read.body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const { data, error } = await supabase.rpc('merchant_job_admin_hide', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_job_id: parsed.jobId, p_hide: parsed.hide, p_note: parsed.note });
  if (error) return rpcFailure(error, 'merchant_job_admin_hide');
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const raw = read.body;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return errorResponse(400, 'VALIDATION_FAILED', 'Invalid request.');
  const { merchantId, ...rest } = raw as Record<string, unknown>;
  if (typeof merchantId !== 'string' || !isMerchantId(merchantId)) return errorResponse(400, 'VALIDATION_FAILED', 'A valid merchantId is required.');
  const parsed = parseJobRequest(rest);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const actor = { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchantId, p_job_id: parsed.jobId };
  const { data, error } = parsed.action === 'save'
    ? await supabase.rpc('merchant_job_save', { ...actor, p_title: parsed.title, p_job_type: parsed.jobType, p_salary: parsed.salary, p_hours: parsed.hours, p_description: parsed.description })
    : await supabase.rpc('merchant_job_action', { ...actor, p_action: parsed.action });
  if (error) return rpcFailure(error, `merchant_job_${parsed.action}`);
  return NextResponse.json({ data });
}
