/* bitesite/app/api/merchant/restaurants/[merchantId]/jobs/route.ts */

/**
 * Owner job posts (#23): GET all posts of this restaurant + canPost; POST
 * `{ action: 'save', jobId, title, jobType, salary?, hours, description }` to create or edit
 * (jobId is chosen by the browser, so a retry never posts twice) or
 * `{ action: 'close'|'renew'|'delete', jobId }`. Posts go public at once while the restaurant is
 * public. 503 FEATURE_OFF until the release SQL runs; the dashboard then hides the section.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { MAX_JOB_BODY_BYTES, mapJobRpcError, parseJobRequest } from '@/lib/merchant-jobs-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function rpcFailure(error: { message: string }, label: string) {
  const mapped = mapJobRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message);
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_jobs_read', { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId });
  if (error) return rpcFailure(error, 'merchant_jobs_read');
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_JOB_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseJobRequest(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const actor = { p_actor_type: 'owner', p_actor_id: auth.user.id, p_merchant_id: merchantId, p_job_id: parsed.jobId };
  const { data, error } = parsed.action === 'save'
    ? await supabase.rpc('merchant_job_save', { ...actor, p_title: parsed.title, p_job_type: parsed.jobType, p_salary: parsed.salary, p_hours: parsed.hours, p_description: parsed.description })
    : await supabase.rpc('merchant_job_action', { ...actor, p_action: parsed.action });
  if (error) return rpcFailure(error, `merchant_job_${parsed.action}`);
  return NextResponse.json({ data });
}
