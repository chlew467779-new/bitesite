/* bitesite/app/api/_lib/merchant-field-patch.ts */

/**
 * Server side of the D2-A field save, shared by the Owner and Admin endpoints. The caller has
 * already established the actor (Owner: verified Supabase user; Admin: verified Admin session);
 * this module only ever passes that actor to the database, never anything from the body.
 * Authorization, locks, compare-and-set, audit and idempotency all happen inside one RPC call
 * (public.merchant_field_patch); public pages are refreshed only after it committed.
 *
 * Lives under app/api/ because it uses the service-role client (scripts/check-service-role-usage.mjs).
 */

import 'server-only';
import { isListingBasicsPatch, mapReviewRpcError } from '@/lib/merchant-review-core.mjs';
import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { AMENITY_TAGS, CUISINE_TAGS, OCCASION_TAGS } from '@/lib/presets';
import {
  MAX_FIELD_PATCH_BODY_BYTES,
  fieldPatchResponse,
  parseFieldPatchRequest,
  type FieldActorType,
} from '@/lib/merchant-field-patch-core.mjs';

export type FieldActor = { type: 'owner'; userId: string } | { type: 'admin' };

/** The only Admin principal: the shared Admin session has no personal user (see migration). */
export const ADMIN_PRINCIPAL = 'legacy_admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorArgs(actor: FieldActor): { p_actor_type: FieldActorType; p_actor_id: string } {
  return actor.type === 'owner' ? { p_actor_type: 'owner', p_actor_id: actor.userId } : { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL };
}

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

const TAG_PRESETS: Record<string, readonly string[]> = {
  'tags.cuisine': CUISINE_TAGS,
  'tags.amenities': AMENITY_TAGS,
  'tags.occasion': OCCASION_TAGS,
};

/**
 * Controlled tags: every tag must be a preset, except tags the restaurant already had (in the
 * expected snapshot), which may stay so an edit never silently drops older values.
 */
function tagErrors(patches: { path: string; expected: unknown; value: unknown }[]) {
  const errors: Record<string, string> = {};
  for (const patch of patches) {
    const preset = TAG_PRESETS[patch.path];
    if (!preset || !Array.isArray(patch.value)) continue;
    const expected = patch.expected as { exists: boolean; value?: unknown };
    const stored = expected.exists && Array.isArray(expected.value) ? (expected.value as unknown[]) : [];
    const invalid = (patch.value as string[]).filter((tag) => !preset.includes(tag) && !stored.includes(tag));
    if (invalid.length) errors[patch.path] = `Choose from the list: "${invalid[0]}" is not available.`;
  }
  return errors;
}

export function isMerchantId(value: string) {
  return UUID_PATTERN.test(value);
}

/** GET: every path the actor may see, as snapshots, plus revision. */
export async function readMerchantFields(actor: FieldActor, merchantId: string) {
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_field_snapshot_read', { ...actorArgs(actor), p_merchant_id: merchantId });
  if (error) {
    const mapped = mapReviewRpcError(error);
    if (mapped.status === 500) console.error('merchant_field_snapshot_read failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  const snapshot = data as { revision: number; updatedAt: string; fields: Record<string, unknown> };
  return NextResponse.json({ data: { fields: snapshot.fields, updatedAt: snapshot.updatedAt }, revision: snapshot.revision }, { headers: { 'Cache-Control': 'no-store' } });
}

/** PATCH: validate, run the atomic RPC, map the result, refresh public pages after commit. */
export async function patchMerchantFields(request: NextRequest, actor: FieldActor, merchantId: string) {
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_FIELD_PATCH_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }

  const basics = actor.type === 'owner' && isListingBasicsPatch(body);
  const parsed = parseFieldPatchRequest(body, basics ? 'admin' : actor.type);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message, parsed.fieldErrors ? { fieldErrors: parsed.fieldErrors } : {});
  const invalidTags = tagErrors(parsed.patches);
  if (Object.keys(invalidTags).length > 0) return errorResponse(400, 'VALIDATION_FAILED', 'Please fix the highlighted fields.', { fieldErrors: invalidTags });

  const { data, error } = await supabase.rpc(basics ? 'merchant_listing_basics_patch' : 'merchant_field_patch', {
    ...actorArgs(actor),
    p_merchant_id: merchantId,
    p_request_id: parsed.requestId,
    p_patches: parsed.patches,
  });
  if (error) {
    const mapped = mapReviewRpcError(error);
    if (mapped.status === 500) console.error('merchant_field_patch failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  }

  const result = data as { status?: string };
  // Refresh after commit. A replay refreshes again, in case the first response or refresh was lost.
  if (result?.status === 'applied') await revalidateMerchant(merchantId);
  const response = fieldPatchResponse(data, parsed.requestId);
  return NextResponse.json(response.body, { status: response.status });
}

async function revalidateMerchant(merchantId: string) {
  const { data } = await supabase.from('merchants').select('slug').eq('id', merchantId).maybeSingle();
  if (data?.slug) revalidatePath(`/store/${data.slug}`);
  revalidatePath('/');
}
