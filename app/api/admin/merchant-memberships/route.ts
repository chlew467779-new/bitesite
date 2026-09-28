import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';

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

    // One transaction: the previous Owner (if any) is suspended before the new one is activated,
    // both audited (merchant_owner_assign, 20260928120000).
    const { data, error } = await supabase.rpc('merchant_owner_assign', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: merchant_id, p_user_id: user.id });
    if (error) {
      console.error('merchant_owner_assign failed:', error.message);
      return NextResponse.json({ error: 'Could not link the Owner. Please try again.' }, { status: 500 });
    }
    const result = data as { status: 'applied' | 'noop'; membershipId: string; previousUserId: string | null };
    const previousEmail = result.previousUserId
      ? users.users.find((candidate) => candidate.id === result.previousUserId)?.email ?? 'another account'
      : null;
    return NextResponse.json({ membership: { id: result.membershipId }, outcome: result.status, previousOwnerEmail: previousEmail, success: true }, { status: result.status === 'applied' ? 201 : 200 });
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
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'This restaurant already has an active Owner. To hand it to this account, use Link user with their email instead.' }, { status: 409 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: auditError } = await supabase.from('merchant_membership_audit').insert({ membership_id: current.id, merchant_id: current.merchant_id, action: body.status === 'active' ? 'activated' : 'suspended', previous_user_id: current.user_id, user_id: current.user_id, actor: 'admin' });
    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });
    return NextResponse.json({ membership: data, success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
