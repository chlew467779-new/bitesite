import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

function authError(request: Request) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;
  const { data, error } = await supabase
    .from('merchant_profile_change_requests')
    .select('id, merchant_id, changes, status, admin_notes, created_at, reviewed_at, merchant:merchants(name, slug)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;
  try {
    const body = await readBoundedJson(request, 16 * 1024);
    if (typeof body.id !== 'string' || !['resolved', 'rejected'].includes(String(body.status))) {
      return NextResponse.json({ error: 'id and status (resolved or rejected) are required' }, { status: 400 });
    }
    if (body.admin_notes !== undefined && body.admin_notes !== null && (typeof body.admin_notes !== 'string' || body.admin_notes.length > 2000)) {
      return NextResponse.json({ error: 'admin_notes must be 2000 characters or fewer' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('merchant_profile_change_requests')
      .update({ status: body.status, admin_notes: typeof body.admin_notes === 'string' ? body.admin_notes.trim() || null : null, reviewed_at: new Date().toISOString(), reviewed_by: 'admin' })
      .eq('id', body.id)
      .eq('status', 'pending')
      .select('id, status, admin_notes, reviewed_at')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Pending request not found' }, { status: 404 });
    return NextResponse.json({ request: data, success: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
