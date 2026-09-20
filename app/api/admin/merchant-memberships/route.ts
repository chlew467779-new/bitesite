import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

function authError(request: Request) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;
  const { data, error } = await supabase
    .from('merchant_memberships')
    .select('id, merchant_id, user_id, role, status, created_at, merchant:merchants(id, name, slug)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;
  try {
    const { merchant_id, user_email } = await request.json();
    if (typeof merchant_id !== 'string' || typeof user_email !== 'string' || !user_email.trim()) {
      return NextResponse.json({ error: 'merchant_id and user_email are required' }, { status: 400 });
    }
    const { data: merchant } = await supabase.from('merchants').select('id').eq('id', merchant_id).maybeSingle();
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });
    const user = users.users.find((candidate) => candidate.email?.toLowerCase() === user_email.trim().toLowerCase());
    if (!user) return NextResponse.json({ error: 'No Supabase user exists for that email yet' }, { status: 404 });

    const { data: existing } = await supabase.from('merchant_memberships').select('id, user_id, status').eq('merchant_id', merchant_id).eq('status', 'active').maybeSingle();
    const { data, error } = await supabase.from('merchant_memberships')
      .upsert({ merchant_id, user_id: user.id, role: 'owner', status: 'active' }, { onConflict: 'merchant_id,user_id' })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (existing && existing.user_id !== user.id) {
      await supabase.from('merchant_memberships').update({ status: 'suspended' }).eq('id', existing.id);
    }
    const { error: auditError } = await supabase.from('merchant_membership_audit').insert({
      membership_id: data.id,
      merchant_id,
      action: 'linked',
      previous_user_id: existing?.user_id || null,
      user_id: user.id,
      actor: 'admin',
    });
    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });
    return NextResponse.json({ membership: data, success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (typeof body.id !== 'string' || !['active', 'suspended'].includes(body.status)) {
      return NextResponse.json({ error: 'id and status (active or suspended) are required' }, { status: 400 });
    }
    const { data: current, error: currentError } = await supabase.from('merchant_memberships').select('id, merchant_id, user_id, status').eq('id', body.id).maybeSingle();
    if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    const { data, error } = await supabase.from('merchant_memberships').update({ status: body.status }).eq('id', current.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: auditError } = await supabase.from('merchant_membership_audit').insert({ membership_id: current.id, merchant_id: current.merchant_id, action: body.status === 'active' ? 'activated' : 'suspended', previous_user_id: current.user_id, user_id: current.user_id, actor: 'admin' });
    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });
    return NextResponse.json({ membership: data, success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
