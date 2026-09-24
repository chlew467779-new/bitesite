import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { PROFILE_FIELD_LIMITS, PROFILE_TEXT_FIELDS, validateProfile } from '@/lib/merchant-profile-validation.mjs';
import { WEEK_DAYS, isEditorHoursValue } from '@/lib/merchant-hours.mjs';

const MAX_PROFILE_BODY_BYTES = 64 * 1024;
// The editable whitelist and its limits live in lib/merchant-profile-validation.mjs, shared with
// the dashboard form. Name, address, slug, status and layout are deliberately not in it.
const editableTextFields = PROFILE_TEXT_FIELDS;
const editableTextLimits = PROFILE_FIELD_LIMITS;
const operatingHourDays = new Set<string>(WEEK_DAYS);
const HOURS_FORMAT_MESSAGE = 'Choose Open with times from the picker, or Closed.';

function accessToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

// Hard ceiling before the per-field rules run; field limits themselves are reported per field.
function normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null | undefined | NextResponse {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
  const normalized = value.trim();
  if (normalized.length > maxLength * 2) return NextResponse.json({ error: `${field} must be ${maxLength} characters or fewer` }, { status: 400 });
  return normalized || null;
}

function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
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

function fieldErrorResponse(fieldErrors: Record<string, string>) {
  return NextResponse.json({ error: 'Please fix the highlighted fields.', fieldErrors }, { status: 400 });
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

    // Format rules apply to values that changed, so a stored value saved before a rule existed
    // (or written by Admin) never blocks saving other fields.
    const { data: current, error: currentError } = await supabase
      .from('merchants')
      .select([...editableTextFields, 'operating_hours'].join(', '))
      .eq('id', membership.merchant_id)
      .single();
    if (currentError || !current) return NextResponse.json({ error: 'Could not load your listing' }, { status: 500 });
    const currentRow = current as unknown as Record<string, unknown>;
    const fieldErrors: Record<string, string> = { ...validateProfile(updateData as Record<string, string | null>, currentRow as Record<string, string | null>) };
    if (operatingHours) {
      const storedHours = (currentRow.operating_hours && typeof currentRow.operating_hours === 'object' ? currentRow.operating_hours : {}) as Record<string, unknown>;
      for (const [day, value] of Object.entries(operatingHours)) {
        const stored = storedHours[day];
        const unchanged = typeof stored === 'string' && value === stored.trim();
        if (!isEditorHoursValue(value) && !unchanged) fieldErrors[`operating_hours.${day}`] = HOURS_FORMAT_MESSAGE;
      }
    }
    if (Object.keys(fieldErrors).length > 0) return fieldErrorResponse(fieldErrors);
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
