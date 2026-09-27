import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { PROFILE_FIELD_LIMITS, PROFILE_TEXT_FIELDS, validateProfile } from '@/lib/merchant-profile-validation.mjs';
import { WEEK_DAYS, isEditorHoursValue } from '@/lib/merchant-hours.mjs';
import { resolveMerchantAccess } from '@/lib/merchant-access-core.mjs';
import {
  MERCHANT_WRITABLE_STATE_FILTER,
  loadOwnedMerchants,
  merchantErrorResponse,
  ownedMerchantSummaries,
  requestedMerchantId,
  requireMerchantAccess,
  requireMerchantUser,
} from '@/app/api/merchant/_lib/merchant-access';

const MAX_PROFILE_BODY_BYTES = 64 * 1024;
// The editable whitelist and its limits live in lib/merchant-profile-validation.mjs, shared with
// the dashboard form. Name, address, slug, status and layout are deliberately not in it.
const editableTextFields = PROFILE_TEXT_FIELDS;
const editableTextLimits = PROFILE_FIELD_LIMITS;
const operatingHourDays = new Set<string>(WEEK_DAYS);
const HOURS_FORMAT_MESSAGE = 'Choose Open with times from the picker, or Closed.';
// The Owner's private view of one merchant: an explicit column list, not the whole row.
const PROFILE_COLUMNS = ['id', 'name', 'slug', 'address', 'business_status', 'platform_status', ...editableTextFields, 'operating_hours'].join(', ');

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

/**
 * Account bootstrap: the verified account, a summary of every restaurant it owns, and the private
 * profile of the selected one. The selection is `?merchantId=`; without it, only an account with
 * exactly one restaurant gets a profile (none or several: `merchant: null`, the page asks).
 */
export async function GET(request: NextRequest) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const owned = await loadOwnedMerchants(auth.user.id);
  if ('response' in owned) return owned.response;

  const account = { id: auth.user.id, email: auth.user.email ?? null };
  const merchants = ownedMerchantSummaries(owned.merchants);
  const requested = requestedMerchantId(request);
  if (requested === undefined && owned.merchants.length !== 1) return NextResponse.json({ account, merchants, merchant: null });

  const access = resolveMerchantAccess({ merchants: owned.merchants, requestedMerchantId: requested, capability: 'read' });
  if (!access.ok) return merchantErrorResponse(access.status, access.code, access.message);
  const { data, error } = await supabase.from('merchants').select(PROFILE_COLUMNS).eq('id', access.merchant.id).maybeSingle();
  if (error) return merchantErrorResponse(500, 'INTERNAL_ERROR', 'We could not load this restaurant. Please try again.');
  if (!data) return merchantErrorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  return NextResponse.json({ account, merchants, merchant: { ...(data as unknown as Record<string, unknown>), restriction: access.restriction } });
}

function fieldErrorResponse(fieldErrors: Record<string, string>) {
  return NextResponse.json({ error: 'Please fix the highlighted fields.', fieldErrors }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const access = await requireMerchantAccess(request, 'write');
  if ('response' in access) return access.response;
  const merchantId = access.merchant.id;
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
      .eq('id', merchantId)
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
    // The UPDATE itself only matches while the restaurant is still writable, so a suspension that
    // lands after the access check cannot be overwritten. Field-level CAS arrives with D2.
    const { data, error } = await supabase
      .from('merchants')
      .update(updateData)
      .eq('id', merchantId)
      .eq('platform_restriction', 'none')
      .or(MERCHANT_WRITABLE_STATE_FILTER)
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (error) return merchantErrorResponse(500, 'INTERNAL_ERROR', 'Your changes could not be saved. Please try again.');
    if (!data) return merchantErrorResponse(403, 'OPERATION_FORBIDDEN', 'This restaurant can no longer be changed.');
    const saved = data as unknown as Record<string, unknown> & { slug: string };
    revalidatePath(`/store/${saved.slug}`);
    revalidatePath('/');
    return NextResponse.json({ merchant: { ...saved, restriction: access.restriction } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
