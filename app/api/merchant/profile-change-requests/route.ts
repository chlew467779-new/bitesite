import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantAccess } from '@/app/api/merchant/_lib/merchant-access';
import { mapFieldRpcError } from '@/lib/merchant-field-patch-core.mjs';

const MAX_BODY_BYTES = 16 * 1024;
const requestableFields = ['name', 'address', 'slug', 'business_status'] as const;
const businessStatuses = new Set(['OPEN', 'TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED']);
const fieldLimits = { name: 160, address: 500, slug: 200 } as const;

export async function GET(request: NextRequest) {
  const context = await requireMerchantAccess(request, 'read');
  if ('response' in context) return context.response;
  const { data, error } = await supabase
    .from('merchant_profile_change_requests')
    .select('id, changes, status, admin_notes, created_at, reviewed_at')
    .eq('merchant_id', context.merchant.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await requireMerchantAccess(request, 'write');
  if ('response' in context) return context.response;
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
    // D2-A: inserted in one transaction that locks and rechecks the restaurant and Owner membership.
    const { data, error } = await supabase.rpc('merchant_profile_change_request_create', {
      p_user_id: context.user.id,
      p_merchant_id: context.merchant.id,
      p_changes: changes,
    });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You already have a profile change request awaiting review' }, { status: 409 });
      const mapped = mapFieldRpcError(error);
      if (mapped.status === 500) console.error('merchant_profile_change_request_create failed:', error.message);
      return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
    }
    return NextResponse.json({ request: data, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
