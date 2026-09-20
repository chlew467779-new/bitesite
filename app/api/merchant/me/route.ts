import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_PROFILE_BODY_BYTES = 64 * 1024;
const editableTextFields = ['tagline', 'description', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook', 'cover_image', 'logo_image', 'menu_pdf_url'] as const;
const editableTextLimits: Record<typeof editableTextFields[number], number> = {
  tagline: 300,
  description: 10000,
  phone: 40,
  whatsapp: 40,
  email: 254,
  website: 2048,
  instagram: 2048,
  facebook: 2048,
  cover_image: 2048,
  logo_image: 2048,
  menu_pdf_url: 2048,
};
const operatingHourDays = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

function accessToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

function normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null | undefined | NextResponse {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
  const normalized = value.trim();
  if (normalized.length > maxLength) return NextResponse.json({ error: `${field} must be ${maxLength} characters or fewer` }, { status: 400 });
  return normalized || null;
}

function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeOperatingHours(value: unknown): Record<string, string> | null | undefined | NextResponse {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return NextResponse.json({ error: 'operating_hours must be an object' }, { status: 400 });
  }

  const hours: Record<string, string> = {};
  for (const [day, rawHours] of Object.entries(value)) {
    if (!operatingHourDays.has(day)) return NextResponse.json({ error: 'operating_hours contains an invalid day' }, { status: 400 });
    if (typeof rawHours !== 'string') return NextResponse.json({ error: 'operating_hours values must be strings' }, { status: 400 });
    const normalized = rawHours.trim();
    if (normalized.length > 100) return NextResponse.json({ error: 'operating_hours values must be 100 characters or fewer' }, { status: 400 });
    if (normalized) hours[day] = normalized;
  }
  return Object.keys(hours).length ? hours : null;
}

export async function GET(request: NextRequest) {
  const token = accessToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('merchant_memberships')
    .select('merchant:merchants(*)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const merchant = data?.merchant;
  if (!merchant) return NextResponse.json({ error: 'No active merchant membership' }, { status: 404 });
  return NextResponse.json({ merchant });
}

export async function PUT(request: NextRequest) {
  const token = accessToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: membership, error: membershipError } = await supabase.from('merchant_memberships').select('merchant_id').eq('user_id', userData.user.id).eq('status', 'active').limit(1).maybeSingle();
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: 'No active merchant membership' }, { status: 404 });
  try {
    const body = await readBoundedJson(request, MAX_PROFILE_BODY_BYTES);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const updateData: Record<string, unknown> = {};
    for (const field of editableTextFields) {
      const value = normalizeOptionalText(body[field], field, editableTextLimits[field]);
      if (isErrorResponse(value)) return value;
      if (value !== undefined) updateData[field] = value;
    }
    const operatingHours = normalizeOperatingHours(body.operating_hours);
    if (isErrorResponse(operatingHours)) return operatingHours;
    if (operatingHours !== undefined) updateData.operating_hours = operatingHours;
    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 });
    if (typeof updateData.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
      return NextResponse.json({ error: 'email must be valid' }, { status: 400 });
    }
    for (const field of ['website', 'instagram', 'facebook', 'cover_image', 'logo_image', 'menu_pdf_url'] as const) {
      const value = updateData[field];
      if (typeof value === 'string' && !validHttpUrl(value)) return NextResponse.json({ error: `${field} must be a valid http(s) URL` }, { status: 400 });
    }
    const { data, error } = await supabase.from('merchants').update(updateData).eq('id', membership.merchant_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath(`/store/${data.slug}`);
    revalidatePath('/');
    return NextResponse.json({ merchant: data });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
