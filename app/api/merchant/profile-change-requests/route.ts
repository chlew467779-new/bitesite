import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_BODY_BYTES = 16 * 1024;
const requestableFields = ['name', 'address', 'slug', 'business_status'] as const;
const businessStatuses = new Set(['OPEN', 'TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED']);
const fieldLimits = { name: 160, address: 500, slug: 200 } as const;

function accessToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

async function merchantContext(request: NextRequest) {
  const token = accessToken(request);
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data, error } = await supabase
    .from('merchant_memberships')
    .select('merchant:merchants(id, name, slug)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  const merchantValue = data?.merchant as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null | undefined;
  const merchant = Array.isArray(merchantValue) ? merchantValue[0] : merchantValue;
  if (!merchant) return { error: NextResponse.json({ error: 'No active merchant membership' }, { status: 404 }) };
  return { merchant, user: userData.user };
}

export async function GET(request: NextRequest) {
  const context = await merchantContext(request);
  if (context.error) return context.error;
  const { data, error } = await supabase
    .from('merchant_profile_change_requests')
    .select('id, changes, status, admin_notes, created_at, reviewed_at')
    .eq('merchant_id', context.merchant.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await merchantContext(request);
  if (context.error) return context.error;
  try {
    const body = await readBoundedJson(request, MAX_BODY_BYTES);
    const rawChanges = body.changes;
    if (!rawChanges || typeof rawChanges !== 'object' || Array.isArray(rawChanges)) {
      return NextResponse.json({ error: 'changes must be an object' }, { status: 400 });
    }
    const changes: Record<string, string> = {};
    for (const [field, rawValue] of Object.entries(rawChanges)) {
      if (!requestableFields.includes(field as typeof requestableFields[number])) {
        return NextResponse.json({ error: `Unsupported requested field: ${field}` }, { status: 400 });
      }
      if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return NextResponse.json({ error: `${field} must be a non-empty string` }, { status: 400 });
      }
      const value = rawValue.trim();
      if (field === 'business_status') {
        if (!businessStatuses.has(value)) return NextResponse.json({ error: 'Invalid business_status' }, { status: 400 });
      } else {
        const limit = fieldLimits[field as keyof typeof fieldLimits];
        if (value.length > limit) return NextResponse.json({ error: `${field} must be ${limit} characters or fewer` }, { status: 400 });
        if (field === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return NextResponse.json({ error: 'slug may contain lowercase letters, numbers, and single hyphens only' }, { status: 400 });
        }
      }
      changes[field] = value;
    }
    if (Object.keys(changes).length === 0) return NextResponse.json({ error: 'Choose at least one change to request' }, { status: 400 });
    const { data, error } = await supabase
      .from('merchant_profile_change_requests')
      .insert({ merchant_id: context.merchant.id, requested_by: context.user.id, changes })
      .select('id, changes, status, admin_notes, created_at')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You already have a profile change request awaiting review' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ request: data, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
