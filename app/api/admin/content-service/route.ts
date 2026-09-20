/* bitesite/app/api/admin/content-service/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_CONTENT_SERVICE_BODY_BYTES = 64 * 1024;

function bodyErrorResponse(error: unknown) {
  if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
  if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
  return null;
}

const cycleStatuses = ['active', 'due', 'overdue', 'completed', 'inactive'] as const;
const requestStatuses = ['requested', 'paid', 'in_progress', 'completed', 'cancelled'] as const;
type Market = 'MY' | 'SG';

function denied(request: Request) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function isIn<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function cycleView(cycle: Record<string, unknown>) {
  const status = cycle.status;
  if (status !== 'active' || typeof cycle.due_at !== 'string') return { ...cycle, effective_status: status };
  const dueAt = new Date(cycle.due_at).getTime();
  const days = 24 * 60 * 60 * 1000;
  const untilDue = dueAt - Date.now();
  const overdueBy = Date.now() - dueAt;
  const effective_status = untilDue > 14 * days ? 'active' : untilDue > 0 ? 'due' : overdueBy < 14 * days ? 'overdue' : 'inactive';
  return { ...cycle, effective_status };
}

export async function GET(request: NextRequest) {
  const authError = denied(request);
  if (authError) return authError;
  const type = new URL(request.url).searchParams.get('type') || 'all';
  if (!['all', 'cycles', 'requests'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  try {
    const result: Record<string, unknown> = {};
    if (type === 'all' || type === 'cycles') {
      const { data, error } = await supabase.from('merchant_content_cycles').select('*').order('due_at', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      result.cycles = (data || []).map(cycleView);
    }
    if (type === 'all' || type === 'requests') {
      const { data, error } = await supabase.from('assisted_content_requests').select('*').order('requested_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      result.requests = data || [];
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = denied(request);
  if (authError) return authError;
  try {
    const body = await readBoundedJson(request, MAX_CONTENT_SERVICE_BODY_BYTES);
    if (!body.merchant_slug || typeof body.merchant_slug !== 'string') return NextResponse.json({ error: 'merchant_slug is required' }, { status: 400 });
    const type = body.type || 'cycle';
    if (type === 'cycle') {
      const { data: existing } = await supabase.from('merchant_content_cycles').select('id').eq('merchant_slug', body.merchant_slug).in('status', ['active', 'due', 'overdue']).limit(1);
      if (existing?.length) return NextResponse.json({ error: 'Merchant already has an active content cycle' }, { status: 409 });
      const start = body.cycle_start_at ? new Date(body.cycle_start_at) : new Date();
      if (Number.isNaN(start.getTime())) return NextResponse.json({ error: 'Invalid cycle_start_at' }, { status: 400 });
      const due = body.due_at ? new Date(body.due_at) : new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(due.getTime()) || due <= start) return NextResponse.json({ error: 'due_at must be after cycle_start_at' }, { status: 400 });
      const { data, error } = await supabase.from('merchant_content_cycles').insert({ merchant_slug: body.merchant_slug, cycle_start_at: start.toISOString(), due_at: due.toISOString(), notes: body.notes || null }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ cycle: cycleView(data), success: true }, { status: 201 });
    }
    if (type === 'assisted_request') {
      const market: Market = body.market === 'SG' ? 'SG' : 'MY';
      const { data, error } = await supabase.from('assisted_content_requests').insert({
        merchant_slug: body.merchant_slug,
        cycle_id: body.cycle_id || null,
        market,
        currency: market === 'SG' ? 'SGD' : 'MYR',
        price_amount: market === 'SG' ? 10 : 20,
        notes: body.notes || null,
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ request: data, success: true }, { status: 201 });
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    const bodyError = bodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const authError = denied(request);
  if (authError) return authError;
  try {
    const body = await readBoundedJson(request, MAX_CONTENT_SERVICE_BODY_BYTES);
    if (!body.id || !body.type || !body.status) return NextResponse.json({ error: 'id, type and status are required' }, { status: 400 });
    const table = body.type === 'cycle' ? 'merchant_content_cycles' : body.type === 'assisted_request' ? 'assisted_content_requests' : null;
    const statuses = body.type === 'cycle' ? cycleStatuses : body.type === 'assisted_request' ? requestStatuses : null;
    if (!table || !statuses || !isIn(body.status, statuses)) return NextResponse.json({ error: 'Invalid type or status' }, { status: 400 });
    const updateData: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString() };
    if (body.notes !== undefined) updateData.notes = body.notes;
    updateData.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
    const { data, error } = await supabase.from(table).update(updateData).eq('id', body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Completing an assisted request fulfils its linked content cycle as well.
    // Keep this best-effort so a service-status update is never blocked by
    // reminder metadata.
    if (body.type === 'assisted_request' && body.status === 'completed' && data?.cycle_id) {
      const { error: cycleError } = await supabase
        .from('merchant_content_cycles')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', data.cycle_id)
        .in('status', ['active', 'due', 'overdue']);
      if (cycleError) console.error('Assisted content cycle completion error:', cycleError);
    }
    return NextResponse.json({ [body.type === 'cycle' ? 'cycle' : 'request']: body.type === 'cycle' ? cycleView(data) : data, success: true });
  } catch (error) {
    const bodyError = bodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
